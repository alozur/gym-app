import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { db, type DbProgram } from "@/db/index";
import { useAuthContext } from "@/context/AuthContext";
import { api } from "@/api/client";
import type { ProgramResponse } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Programs() {
  const navigate = useNavigate();
  const { state: authState } = useAuthContext();
  const [programs, setPrograms] = useState<DbProgram[]>([]);
  const [routineCounts, setRoutineCounts] = useState<Record<string, number>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DbProgram | null>(null);

  const loadPrograms = useCallback(async () => {
    setIsLoading(true);

    // Load from Dexie first
    const local = await db.programs.toArray();
    setPrograms(local);

    // Load routine counts
    const counts: Record<string, number> = {};
    for (const p of local) {
      counts[p.id] = await db.programRoutines
        .where("program_id")
        .equals(p.id)
        .count();
    }
    setRoutineCounts(counts);

    // If authenticated and online, fetch from API and update Dexie
    if (authState.isAuthenticated && navigator.onLine) {
      try {
        const remote = await api.get<ProgramResponse[]>("/programs");
        const mapped: DbProgram[] = remote.map((p) => ({
          id: p.id,
          user_id: authState.user?.id ?? "",
          name: p.name,
          deload_every_n_weeks: p.deload_every_n_weeks,
          is_active: p.is_active,
          started_at: p.started_at,
          current_routine_index: p.current_routine_index,
          weeks_completed: p.weeks_completed,
          last_workout_at: p.last_workout_at,
          created_at: p.created_at,
          sync_status: "synced" as const,
        }));

        await db.programs.bulkPut(mapped);
        const updated = await db.programs.toArray();
        setPrograms(updated);

        const updatedCounts: Record<string, number> = {};
        for (const p of updated) {
          updatedCounts[p.id] = await db.programRoutines
            .where("program_id")
            .equals(p.id)
            .count();
        }
        setRoutineCounts(updatedCounts);
      } catch {
        // Use cached data
      }
    }

    setIsLoading(false);
  }, [authState.isAuthenticated, authState.user?.id]);

  useEffect(() => {
    void loadPrograms();
  }, [loadPrograms]);

  async function handleDelete() {
    if (!deleteTarget) return;

    // Delete program routines from Dexie
    await db.programRoutines
      .where("program_id")
      .equals(deleteTarget.id)
      .delete();

    // Delete program from Dexie
    await db.programs.delete(deleteTarget.id);

    // Try to delete from API if online
    if (navigator.onLine) {
      try {
        await api.delete(`/programs/${deleteTarget.id}`);
      } catch {
        // Will be handled on next sync
      }
    }

    setDeleteTarget(null);
    await loadPrograms();
  }

  async function handleToggleActive(program: DbProgram) {
    const newActive = !program.is_active;

    // If activating, deactivate all others first
    if (newActive) {
      const allPrograms = await db.programs.toArray();
      for (const p of allPrograms) {
        if (p.id !== program.id && p.is_active) {
          await db.programs.update(p.id, {
            is_active: false,
            sync_status: "pending",
          });
        }
      }
    }

    await db.programs.update(program.id, {
      is_active: newActive,
      started_at: newActive ? new Date().toISOString() : null,
      sync_status: "pending",
    });

    if (navigator.onLine) {
      try {
        if (newActive) {
          await api.post(`/programs/${program.id}/activate`);
        } else {
          await api.post(`/programs/${program.id}/deactivate`);
        }
      } catch {
        // Will sync later
      }
    }

    await loadPrograms();
  }

  function getWeekIndicator(program: DbProgram): {
    text: string;
    isDeload: boolean;
  } {
    const isDeload =
      program.weeks_completed % program.deload_every_n_weeks ===
      program.deload_every_n_weeks - 1;

    if (isDeload) {
      return { text: "DELOAD WEEK", isDeload: true };
    }

    const weekNum =
      (program.weeks_completed % program.deload_every_n_weeks) + 1;
    return {
      text: `Week ${weekNum} of ${program.deload_every_n_weeks}`,
      isDeload: false,
    };
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Programs</h1>
          <Button onClick={() => navigate("/programs/new")}>
            Create Program
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : programs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No programs yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first program to get started
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {programs.map((program) => {
              const weekInfo = program.is_active
                ? getWeekIndicator(program)
                : null;

              return (
                <Card key={program.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-1">
                      <CardTitle>{program.name}</CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-2">
                        <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs">
                          {routineCounts[program.id] ?? 0} routine
                          {(routineCounts[program.id] ?? 0) !== 1 ? "s" : ""}
                        </span>
                        {program.is_active && (
                          <span className="inline-block rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
                            Active
                          </span>
                        )}
                        {weekInfo && (
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              weekInfo.isDeload
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {weekInfo.text}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <CardAction>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void handleToggleActive(program)
                          }
                        >
                          {program.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/programs/${program.id}`)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteTarget(program)}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardAction>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Program</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
