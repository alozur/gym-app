import { useCallback, useEffect, useRef, useState } from "react";
import { db, SYNC_STATUS } from "@/db/index.ts";
import { api } from "@/api/client.ts";
import type { SyncRequest, SyncResponse } from "@/types.ts";

const SYNC_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 60_000;

interface UseSyncReturn {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncError: string | null;
  syncNow: () => Promise<void>;
}

export function useSync(): UseSyncReturn {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const backoffRef = useRef<number>(1000);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectivityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // ------------------------------------------------------------------
  // Connectivity tracking
  // ------------------------------------------------------------------
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodic connectivity check
    connectivityIntervalRef.current = setInterval(() => {
      setIsOnline(navigator.onLine);
    }, SYNC_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (connectivityIntervalRef.current) {
        clearInterval(connectivityIntervalRef.current);
      }
    };
  }, []);

  // ------------------------------------------------------------------
  // Count pending records
  // ------------------------------------------------------------------
  const refreshPendingCount = useCallback(async () => {
    const sessionsCount = await db.workoutSessions
      .where("sync_status")
      .equals(SYNC_STATUS.pending)
      .count();

    const setsCount = await db.workoutSets
      .where("sync_status")
      .equals(SYNC_STATUS.pending)
      .count();

    setPendingCount(sessionsCount + setsCount);
  }, []);

  // ------------------------------------------------------------------
  // Sync logic
  // ------------------------------------------------------------------
  const syncNow = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return;

    setIsSyncing(true);
    setLastSyncError(null);

    try {
      const pendingSessions = await db.workoutSessions
        .where("sync_status")
        .equals(SYNC_STATUS.pending)
        .toArray();

      const pendingSets = await db.workoutSets
        .where("sync_status")
        .equals(SYNC_STATUS.pending)
        .toArray();

      if (pendingSessions.length === 0 && pendingSets.length === 0) {
        setIsSyncing(false);
        await refreshPendingCount();
        return;
      }

      const payload: SyncRequest = {
        sessions: pendingSessions.map((s) => ({
          id: s.id,
          template_id: s.template_id,
          year_week: s.year_week,
          week_type: s.week_type,
          started_at: s.started_at,
          finished_at: s.finished_at,
          notes: s.notes,
        })),
        sets: pendingSets.map((s) => ({
          id: s.id,
          session_id: s.session_id,
          exercise_id: s.exercise_id,
          set_type: s.set_type,
          set_number: s.set_number,
          reps: s.reps,
          weight: s.weight,
          rpe: s.rpe,
          notes: s.notes,
        })),
      };

      const result = await api.post<SyncResponse>("/sync", payload);

      // Mark synced sessions
      if (result.synced_sessions.length > 0) {
        await db.workoutSessions
          .where("id")
          .anyOf(result.synced_sessions)
          .modify({ sync_status: SYNC_STATUS.synced });
      }

      // Mark synced sets
      if (result.synced_sets.length > 0) {
        await db.workoutSets
          .where("id")
          .anyOf(result.synced_sets)
          .modify({ sync_status: SYNC_STATUS.synced });
      }

      // Reset backoff on success
      backoffRef.current = 1000;
      await refreshPendingCount();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Sync failed";
      setLastSyncError(message);

      // Exponential backoff
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshPendingCount]);

  // ------------------------------------------------------------------
  // Periodic sync & pending count refresh
  // ------------------------------------------------------------------
  useEffect(() => {
    void refreshPendingCount();

    syncIntervalRef.current = setInterval(() => {
      void refreshPendingCount();
      if (navigator.onLine) {
        void syncNow();
      }
    }, SYNC_INTERVAL_MS);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [syncNow, refreshPendingCount]);

  // Trigger sync immediately when coming back online
  useEffect(() => {
    if (isOnline) {
      void syncNow();
    }
  }, [isOnline, syncNow]);

  return { isOnline, pendingCount, isSyncing, lastSyncError, syncNow };
}
