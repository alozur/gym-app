import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { db, type DbProgram, type DbUserProgram } from "@/db/index";
import { useAuthContext } from "@/context/AuthContext";
import { api } from "@/api/client";
import type { ProgramResponse, UserProgramResponse } from "@/types";
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

interface ProgramWithEnrollment {
  program: DbProgram;
  enrollment: DbUserProgram | null;
}

export default function Programs() {
  const navigate = useNavigate();
  const { state: authState } = useAuthContext();
  const userId = authState.user?.id ?? "";
  const [items, setItems] = useState<ProgramWithEnrollment[]>([]);
  const [routineCounts, setRoutineCounts] = useState<Record<string, number>>(
    {},
  );
  const [phaseCounts, setPhaseCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ProgramWithEnrollment | null>(null);

  const loadPrograms = useCallback(async () => {
    setIsLoading(true);

    // Load from Dexie first
    const localPrograms = await db.programs.toArray();
    const localEnrollments = await db.userPrograms
      .where("user_id")
      .equals(userId)
      .toArray();
    const enrollmentMap = new Map(localEnrollments.map((e) => [e.program_id, e]));

    const localItems: ProgramWithEnrollment[] = localPrograms.map((p) => ({
      program: p,
      enrollment: enrollmentMap.get(p.id) ?? null,
    }));
    setItems(localItems);

    // Load routine/phase counts
    const counts: Record<string, number> = {};
    const pCounts: Record<string, number> = {};
    for (const p of localPrograms) {
      if (p.program_type === "phased") {
        pCounts[p.id] = await db.programPhases
          .where("program_id")
          .equals(p.id)
          .count();
      } else {
        counts[p.id] = await db.programRoutines
          .where("program_id")
          .equals(p.id)
          .count();
      }
    }
    setRoutineCounts(counts);
    setPhaseCounts(pCounts);

    // If authenticated and online, fetch from API and update Dexie
    if (authState.isAuthenticated && navigator.onLine) {
      try {
        const [remote, remoteEnrollments] = await Promise.all([
          api.get<ProgramResponse[]>("/programs"),
          api.get<UserProgramResponse[]>("/programs/enrollments"),
        ]);

        const mappedPrograms: DbProgram[] = remote.map((p) => ({
          id: p.id,
          user_id: p.user_id ?? null,
          name: p.name,
          program_type: (p.program_type ?? "rotating") as "rotating" | "phased",
          deload_every_n_weeks: p.deload_every_n_weeks,
          created_at: p.created_at,
          sync_status: "synced" as const,
        }));

        const mappedEnrollments: DbUserProgram[] = remoteEnrollments.map((e) => ({
          id: e.id,
          user_id: e.user_id,
          program_id: e.program_id,
          is_active: e.is_active,
          started_at: e.started_at,
          current_routine_index: e.current_routine_index,
          current_phase_index: e.current_phase_index ?? 0,
          current_week_in_phase: e.current_week_in_phase ?? 0,
          current_day_index: e.current_day_index ?? 0,
          weeks_completed: e.weeks_completed,
          last_workout_at: e.last_workout_at,
          created_at: e.created_at,
          sync_status: "synced" as const,
        }));

        await db.programs.bulkPut(mappedPrograms);
        await db.userPrograms.bulkPut(mappedEnrollments);

        const updatedPrograms = await db.programs.toArray();
        const updatedEnrollments = await db.userPrograms
          .where("user_id")
          .equals(userId)
          .toArray();
        const updatedEnrollmentMap = new Map(
          updatedEnrollments.map((e) => [e.program_id, e]),
        );

        setItems(
          updatedPrograms.map((p) => ({
            program: p,
            enrollment: updatedEnrollmentMap.get(p.id) ?? null,
          })),
        );

        const updatedCounts: Record<string, number> = {};
        const updatedPCounts: Record<string, number> = {};
        for (const p of updatedPrograms) {
          if (p.program_type === "phased") {
            updatedPCounts[p.id] = await db.programPhases
              .where("program_id")
              .equals(p.id)
              .count();
          } else {
            updatedCounts[p.id] = await db.programRoutines
              .where("program_id")
              .equals(p.id)
              .count();
          }
        }
        setRoutineCounts(updatedCounts);
        setPhaseCounts(updatedPCounts);
      } catch {
        // Use cached data
      }
    }

    setIsLoading(false);
  }, [authState.isAuthenticated, userId]);

  useEffect(() => {
    void loadPrograms();
  }, [loadPrograms]);

  async function handleDelete() {
    if (!deleteTarget) return;
    const { program, enrollment } = deleteTarget;

    // Delete enrollment from Dexie
    if (enrollment) {
      await db.userPrograms.delete(enrollment.id);
    }

    // For custom programs, also delete the program itself
    if (program.user_id !== null) {
      await db.programRoutines
        .where("program_id")
        .equals(program.id)
        .delete();
      await db.programs.delete(program.id);
    }

    // Try API if online
    if (navigator.onLine) {
      try {
        await api.delete(`/programs/${program.id}`);
      } catch {
        // Will be handled on next sync
      }
    }

    setDeleteTarget(null);
    await loadPrograms();
  }

  async function handleToggleActive(item: ProgramWithEnrollment) {
    const newActive = !item.enrollment?.is_active;

    if (newActive) {
      // Deactivate all other enrollments locally
      const allEnrollments = await db.userPrograms
        .where("user_id")
        .equals(userId)
        .toArray();
      for (const e of allEnrollments) {
        if (e.program_id !== item.program.id && e.is_active) {
          await db.userPrograms.update(e.id, {
            is_active: false,
            sync_status: "pending",
          });
        }
      }

      // Activate existing enrollment locally
      if (item.enrollment) {
        await db.userPrograms.update(item.enrollment.id, {
          is_active: true,
          started_at: new Date().toISOString(),
          current_routine_index: 0,
          current_phase_index: 0,
          current_week_in_phase: 0,
          current_day_index: 0,
          weeks_completed: 0,
          last_workout_at: null,
          sync_status: "pending",
        });
      }
    } else if (item.enrollment) {
      await db.userPrograms.update(item.enrollment.id, {
        is_active: false,
        sync_status: "pending",
      });
    }

    // Call API - the backend creates an enrollment if none exists
    if (navigator.onLine) {
      try {
        if (newActive) {
          const result = await api.post<UserProgramResponse>(
            `/programs/${item.program.id}/activate`,
          );
          // Save the enrollment returned by the API into Dexie
          await db.userPrograms.put({
            id: result.id,
            user_id: result.user_id,
            program_id: result.program_id,
            is_active: result.is_active,
            started_at: result.started_at,
            current_routine_index: result.current_routine_index,
            current_phase_index: result.current_phase_index ?? 0,
            current_week_in_phase: result.current_week_in_phase ?? 0,
            current_day_index: result.current_day_index ?? 0,
            weeks_completed: result.weeks_completed,
            last_workout_at: result.last_workout_at,
            created_at: result.created_at,
            sync_status: "synced",
          });
        } else {
          await api.post(`/programs/${item.program.id}/deactivate`);
        }
      } catch {
        // Will sync later
      }
    }

    await loadPrograms();
  }

  const [phaseNames, setPhaseNames] = useState<Record<string, string>>({});

  // Load phase names for phased programs
  useEffect(() => {
    void (async () => {
      const allPhases = await db.programPhases.toArray();
      const names: Record<string, string> = {};
      for (const phase of allPhases) {
        names[`${phase.program_id}:${phase.order}`] = phase.name;
      }
      setPhaseNames(names);
    })();
  }, [items]);

  function getWeekIndicator(enrollment: DbUserProgram, program: DbProgram): {
    text: string;
    isDeload: boolean;
  } {
    if (program.program_type === "phased") {
      const phaseName =
        phaseNames[`${program.id}:${enrollment.current_phase_index}`] ?? "";
      const weekNum = enrollment.current_week_in_phase + 1;
      return {
        text: `Phase ${enrollment.current_phase_index + 1}${phaseName ? `: ${phaseName}` : ""} — Week ${weekNum}`,
        isDeload: false,
      };
    }

    const isDeload =
      enrollment.weeks_completed % program.deload_every_n_weeks ===
      program.deload_every_n_weeks - 1;

    if (isDeload) {
      return { text: "DELOAD WEEK", isDeload: true };
    }

    const weekNum =
      (enrollment.weeks_completed % program.deload_every_n_weeks) + 1;
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
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No programs yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first program to get started
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map(({ program, enrollment }) => {
              const isActive = enrollment?.is_active ?? false;
              const weekInfo =
                isActive && enrollment
                  ? getWeekIndicator(enrollment, program)
                  : null;
              const isShared = program.user_id === null;

              return (
                <Card key={program.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-1">
                      <CardTitle>{program.name}</CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-2">
                        {program.program_type === "phased" ? (
                          <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs">
                            {phaseCounts[program.id] ?? 0} phase
                            {(phaseCounts[program.id] ?? 0) !== 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs">
                            {routineCounts[program.id] ?? 0} routine
                            {(routineCounts[program.id] ?? 0) !== 1 ? "s" : ""}
                          </span>
                        )}
                        {isActive && (
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
                            void handleToggleActive({ program, enrollment })
                          }
                        >
                          {isActive ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/programs/${program.id}`)}
                        >
                          {isShared || program.program_type === "phased" ? "View" : "Edit"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setDeleteTarget({ program, enrollment })}
                        >
                          {isShared ? "Unenroll" : "Delete"}
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
            <DialogTitle>
              {deleteTarget?.program.user_id === null
                ? "Unenroll from Program"
                : "Delete Program"}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.program.user_id === null
                ? `Are you sure you want to unenroll from "${deleteTarget?.program.name}"?`
                : `Are you sure you want to delete "${deleteTarget?.program.name}"? This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>
              {deleteTarget?.program.user_id === null ? "Unenroll" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
