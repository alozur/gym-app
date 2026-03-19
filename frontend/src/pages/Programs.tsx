import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import {
  db,
  type DbProgram,
  type DbUserProgram,
  type DbWorkoutSession,
} from "@/db/index";
import { useAuthContext } from "@/context/AuthContext";
import { api } from "@/api/client";
import type {
  ProgramResponse,
  ProgramPhaseDetailResponse,
  UserProgramResponse,
} from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkoutCard {
  id: string;
  name: string;
  dayIndex: number;
  isCompleted: boolean;
  phaseWorkoutId?: string;
  templateId?: string;
  routineIndex?: number;
  weekType?: "normal" | "deload";
}

interface WeekPage {
  weekNumber: number;
  label: string;
  phaseIndex?: number;
  phaseLabel?: string;
  weekInPhase?: number;
  workouts: WorkoutCard[];
}

interface ProgramWithEnrollment {
  program: DbProgram;
  enrollment: DbUserProgram | null;
}

// ---------------------------------------------------------------------------
// Week-page builders
// ---------------------------------------------------------------------------

async function buildPhasedWeeks(
  program: DbProgram,
  enrollment: DbUserProgram,
  completedSessions: DbWorkoutSession[],
): Promise<{ weeks: WeekPage[]; defaultIndex: number }> {
  const completedIds = new Set(
    completedSessions
      .map((s) => s.phase_workout_id)
      .filter((id): id is string => id !== null),
  );

  const phases = await db.programPhases
    .where("program_id")
    .equals(program.id)
    .toArray();
  phases.sort((a, b) => a.order - b.order);

  if (phases.length === 0) return { weeks: [], defaultIndex: 0 };

  const allWorkouts = await db.phaseWorkouts
    .where("phase_id")
    .anyOf(phases.map((p) => p.id))
    .toArray();

  const pages: WeekPage[] = [];
  let defaultIndex = 0;
  let weekOffset = 0;

  for (const phase of phases) {
    const phaseWorkouts = allWorkouts.filter((w) => w.phase_id === phase.id);
    const weekNumbers = [
      ...new Set(phaseWorkouts.map((w) => w.week_number)),
    ].sort((a, b) => a - b);
    const numWeeks = Math.max(
      phase.duration_weeks,
      weekNumbers.length > 0 ? weekNumbers[weekNumbers.length - 1] : 0,
    );

    for (let wn = 1; wn <= numWeeks; wn++) {
      const weekWorkouts = phaseWorkouts
        .filter((w) => w.week_number === wn)
        .sort((a, b) => a.day_index - b.day_index);

      pages.push({
        weekNumber: wn,
        label: `Week ${wn}`,
        phaseIndex: phase.order,
        phaseLabel: `Phase ${phase.order + 1}: ${phase.name}`,
        weekInPhase: wn - 1,
        workouts: weekWorkouts.map((w) => ({
          id: w.id,
          name: w.name,
          dayIndex: w.day_index,
          isCompleted: completedIds.has(w.id),
          phaseWorkoutId: w.id,
        })),
      });
    }

    if (phase.order === enrollment.current_phase_index) {
      defaultIndex = weekOffset + enrollment.current_week_in_phase;
    }
    weekOffset += numWeeks;
  }

  return {
    weeks: pages,
    defaultIndex: Math.min(defaultIndex, Math.max(pages.length - 1, 0)),
  };
}

async function buildRotatingWeeks(
  program: DbProgram,
  enrollment: DbUserProgram,
): Promise<{ weeks: WeekPage[]; defaultIndex: number }> {
  const routines = await db.programRoutines
    .where("program_id")
    .equals(program.id)
    .toArray();
  routines.sort((a, b) => a.order - b.order);

  const numWeeks = program.deload_every_n_weeks;
  if (routines.length === 0 || numWeeks <= 0)
    return { weeks: [], defaultIndex: 0 };

  const templates = await db.workoutTemplates
    .where("id")
    .anyOf(routines.map((r) => r.template_id))
    .toArray();
  const templateMap = new Map(templates.map((t) => [t.id, t]));

  const currentWeekInCycle = enrollment.weeks_completed % numWeeks;

  const pages: WeekPage[] = [];
  for (let w = 0; w < numWeeks; w++) {
    const isDeload = w === numWeeks - 1;
    const wType: "normal" | "deload" = isDeload ? "deload" : "normal";

    pages.push({
      weekNumber: w + 1,
      label: isDeload ? "DELOAD" : `Week ${w + 1} of ${numWeeks}`,
      workouts: routines.map((r, idx) => {
        let isCompleted = false;
        if (w < currentWeekInCycle) {
          isCompleted = true;
        } else if (w === currentWeekInCycle) {
          isCompleted = idx < enrollment.current_routine_index;
        }
        return {
          id: `${r.id}-w${w}`,
          name: templateMap.get(r.template_id)?.name ?? "Unknown",
          dayIndex: idx,
          isCompleted,
          templateId: r.template_id,
          routineIndex: idx,
          weekType: wType,
        };
      }),
    });
  }

  return { weeks: pages, defaultIndex: currentWeekInCycle };
}

async function buildWeekPages(
  program: DbProgram,
  enrollment: DbUserProgram,
): Promise<{ weeks: WeekPage[]; defaultIndex: number }> {
  const sessions = await db.workoutSessions
    .where("user_program_id")
    .equals(enrollment.id)
    .and((s) => s.finished_at !== null)
    .toArray();
  const enrollmentStarted = enrollment.started_at ?? "";
  const currentSessions = sessions.filter(
    (s) => s.started_at >= enrollmentStarted,
  );

  if (program.program_type === "phased") {
    return buildPhasedWeeks(program, enrollment, currentSessions);
  }
  return buildRotatingWeeks(program, enrollment);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Programs() {
  const navigate = useNavigate();
  const { state: authState } = useAuthContext();
  const userId = authState.user?.id ?? "";

  // Active program
  const [activeProgram, setActiveProgram] = useState<DbProgram | null>(null);
  const [activeEnrollment, setActiveEnrollment] =
    useState<DbUserProgram | null>(null);
  const [weekPages, setWeekPages] = useState<WeekPage[]>([]);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(
    null,
  );

  // Library
  const [allPrograms, setAllPrograms] = useState<ProgramWithEnrollment[]>([]);
  const [routineCounts, setRoutineCounts] = useState<Record<string, number>>(
    {},
  );
  const [phaseCounts, setPhaseCounts] = useState<Record<string, number>>({});
  const [showLibrary, setShowLibrary] = useState(false);

  // UI
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] =
    useState<ProgramWithEnrollment | null>(null);
  const touchStartRef = useRef<number | null>(null);

  // -----------------------------------------------------------------------
  // Data loading (helpers inlined to avoid stale-closure risks)
  // -----------------------------------------------------------------------

  const loadData = useCallback(async (signal: { cancelled: boolean }) => {
    setIsLoading(true);

    async function applyActive(
      prog: DbProgram | null,
      enr: DbUserProgram | null,
    ) {
      if (signal.cancelled) return;
      setActiveProgram(prog);
      setActiveEnrollment(enr);
      if (!prog || !enr) {
        setWeekPages([]);
        setSelectedWorkoutId(null);
        return;
      }
      const { weeks, defaultIndex } = await buildWeekPages(prog, enr);
      if (signal.cancelled) return;
      setWeekPages(weeks);
      setCurrentWeekIndex(defaultIndex);
      const dw = weeks[defaultIndex];
      const next = dw?.workouts.find((w) => !w.isCompleted);
      setSelectedWorkoutId(next?.id ?? dw?.workouts[0]?.id ?? null);
    }

    async function refreshCounts(programs: DbProgram[]) {
      const c: Record<string, number> = {};
      const p: Record<string, number> = {};
      for (const prog of programs) {
        if (prog.program_type === "phased") {
          p[prog.id] = await db.programPhases
            .where("program_id")
            .equals(prog.id)
            .count();
        } else {
          c[prog.id] = await db.programRoutines
            .where("program_id")
            .equals(prog.id)
            .count();
        }
      }
      if (signal.cancelled) return;
      setRoutineCounts(c);
      setPhaseCounts(p);
    }

    try {
      // --- Local data ---
      const localPrograms = await db.programs.toArray();
      const localEnrollments = await db.userPrograms
        .where("user_id")
        .equals(userId)
        .toArray();
      if (signal.cancelled) return;

      const enrollmentMap = new Map(
        localEnrollments.map((e) => [e.program_id, e]),
      );
      setAllPrograms(
        localPrograms.map((p) => ({
          program: p,
          enrollment: enrollmentMap.get(p.id) ?? null,
        })),
      );
      await refreshCounts(localPrograms);

      const activeEnr = localEnrollments.find((e) => e.is_active);
      const activeProg = activeEnr
        ? localPrograms.find((p) => p.id === activeEnr.program_id) ?? null
        : null;
      await applyActive(activeProg, activeEnr ?? null);
    } catch {
      /* Dexie query failed — leave previous state */
    }

    // --- API sync ---
    if (authState.isAuthenticated && navigator.onLine) {
      try {
        const [remote, remoteEnrollments] = await Promise.all([
          api.get<ProgramResponse[]>("/programs"),
          api.get<UserProgramResponse[]>("/programs/enrollments"),
        ]);
        if (signal.cancelled) return;

        await db.programs.bulkPut(
          remote.map((p) => ({
            id: p.id,
            user_id: p.user_id ?? null,
            name: p.name,
            program_type: (p.program_type ?? "rotating") as
              | "rotating"
              | "phased",
            deload_every_n_weeks: p.deload_every_n_weeks,
            created_at: p.created_at,
            sync_status: "synced" as const,
          })),
        );
        await db.userPrograms.bulkPut(
          remoteEnrollments.map((e) => ({
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
          })),
        );

        // Hydrate phases
        for (const p of remote) {
          if (signal.cancelled) return;
          if ((p.program_type ?? "rotating") !== "phased") continue;
          try {
            const phases = await api.get<ProgramPhaseDetailResponse[]>(
              `/programs/${p.id}/phases`,
            );
            await db.programPhases.bulkPut(
              phases.map((ph) => ({
                id: ph.id,
                program_id: p.id,
                name: ph.name,
                description: ph.description,
                order: ph.order,
                duration_weeks: ph.duration_weeks,
                sync_status: "synced" as const,
              })),
            );
            const wrs = phases.flatMap((ph) =>
              ph.workouts.map((w) => ({
                id: w.id,
                phase_id: ph.id,
                name: w.name,
                day_index: w.day_index,
                week_number: w.week_number,
                sync_status: "synced" as const,
              })),
            );
            if (wrs.length) await db.phaseWorkouts.bulkPut(wrs);
            const srs = phases.flatMap((ph) =>
              ph.workouts.flatMap((w) =>
                w.sections.map((s) => ({
                  id: s.id,
                  workout_id: w.id,
                  name: s.name,
                  order: s.order,
                  notes: s.notes,
                  sync_status: "synced" as const,
                })),
              ),
            );
            if (srs.length) await db.phaseWorkoutSections.bulkPut(srs);
            const ers = phases.flatMap((ph) =>
              ph.workouts.flatMap((w) =>
                w.sections.flatMap((s) =>
                  s.exercises.map((ex) => ({
                    id: ex.id,
                    section_id: s.id,
                    exercise_id: ex.exercise_id,
                    order: ex.order,
                    working_sets: ex.working_sets,
                    reps_display: ex.reps_display,
                    rest_period: ex.rest_period,
                    intensity_technique: ex.intensity_technique,
                    warmup_sets: ex.warmup_sets,
                    notes: ex.notes,
                    substitute1_exercise_id: ex.substitute1_exercise_id,
                    substitute2_exercise_id: ex.substitute2_exercise_id,
                    sync_status: "synced" as const,
                  })),
                ),
              ),
            );
            if (ers.length) await db.phaseWorkoutExercises.bulkPut(ers);
          } catch {
            /* phase hydration failed */
          }
        }

        if (signal.cancelled) return;

        // Reload from Dexie after sync
        const updatedPrograms = await db.programs.toArray();
        const updatedEnrollments = await db.userPrograms
          .where("user_id")
          .equals(userId)
          .toArray();
        const updatedMap = new Map(
          updatedEnrollments.map((e) => [e.program_id, e]),
        );
        setAllPrograms(
          updatedPrograms.map((p) => ({
            program: p,
            enrollment: updatedMap.get(p.id) ?? null,
          })),
        );
        await refreshCounts(updatedPrograms);

        const upActive = updatedEnrollments.find((e) => e.is_active);
        const upProg = upActive
          ? updatedPrograms.find((p) => p.id === upActive.program_id) ?? null
          : null;
        await applyActive(upProg, upActive ?? null);
      } catch {
        /* use cached */
      }
    }

    if (!signal.cancelled) setIsLoading(false);
  }, [authState.isAuthenticated, userId]);

  useEffect(() => {
    const signal = { cancelled: false };
    void loadData(signal);
    return () => { signal.cancelled = true; };
  }, [loadData]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  async function handleToggleActive(item: ProgramWithEnrollment) {
    const newActive = !item.enrollment?.is_active;

    await db.transaction("rw", db.userPrograms, async () => {
      if (newActive) {
        const all = await db.userPrograms
          .where("user_id")
          .equals(userId)
          .toArray();
        for (const e of all) {
          if (e.program_id !== item.program.id && e.is_active) {
            await db.userPrograms.update(e.id, {
              is_active: false,
              sync_status: "pending",
            });
          }
        }
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
    });

    if (navigator.onLine) {
      try {
        if (newActive) {
          const result = await api.post<UserProgramResponse>(
            `/programs/${item.program.id}/activate`,
          );
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
        /* sync later */
      }
    }

    setShowLibrary(false);
    await loadData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { program, enrollment } = deleteTarget;

    if (enrollment) await db.userPrograms.delete(enrollment.id);
    if (program.user_id !== null) {
      // Clean up all program-related data from Dexie
      if (program.program_type === "phased") {
        const phaseIds = (
          await db.programPhases
            .where("program_id")
            .equals(program.id)
            .toArray()
        ).map((p) => p.id);
        if (phaseIds.length) {
          const workoutIds = (
            await db.phaseWorkouts
              .where("phase_id")
              .anyOf(phaseIds)
              .toArray()
          ).map((w) => w.id);
          if (workoutIds.length) {
            const sectionIds = (
              await db.phaseWorkoutSections
                .where("workout_id")
                .anyOf(workoutIds)
                .toArray()
            ).map((s) => s.id);
            if (sectionIds.length)
              await db.phaseWorkoutExercises
                .where("section_id")
                .anyOf(sectionIds)
                .delete();
            await db.phaseWorkoutSections
              .where("workout_id")
              .anyOf(workoutIds)
              .delete();
          }
          await db.phaseWorkouts.where("phase_id").anyOf(phaseIds).delete();
        }
        await db.programPhases
          .where("program_id")
          .equals(program.id)
          .delete();
      } else {
        await db.programRoutines
          .where("program_id")
          .equals(program.id)
          .delete();
      }
      await db.programs.delete(program.id);
    }

    if (navigator.onLine) {
      try {
        await api.delete(`/programs/${program.id}`);
      } catch {
        /* sync later */
      }
    }

    setDeleteTarget(null);
    await loadData();
  }

  function handleStartWorkout() {
    if (!selectedWorkoutId || !activeProgram) return;

    let selectedCard: WorkoutCard | undefined;
    let weekPage: WeekPage | undefined;

    for (const page of weekPages) {
      const card = page.workouts.find((w) => w.id === selectedWorkoutId);
      if (card) {
        selectedCard = card;
        weekPage = page;
        break;
      }
    }
    if (!selectedCard || !weekPage) return;

    if (activeProgram.program_type === "phased") {
      navigate("/workout", {
        state: {
          overridePhaseIndex: weekPage.phaseIndex,
          overrideWeekInPhase: weekPage.weekInPhase,
          overrideDayIndex: selectedCard.dayIndex,
        },
      });
    } else {
      navigate("/workout", {
        state: {
          overrideRoutineIndex: selectedCard.routineIndex,
          overrideWeekType: selectedCard.weekType,
        },
      });
    }
  }

  // Navigate to a specific week and auto-select its first non-completed workout
  function goToWeek(index: number) {
    if (index < 0 || index >= weekPages.length) return;
    setCurrentWeekIndex(index);
    const week = weekPages[index];
    const next = week?.workouts.find((w) => !w.isCompleted);
    setSelectedWorkoutId(next?.id ?? week?.workouts[0]?.id ?? null);
  }

  // Touch swipe for week navigation
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return; // ignore multi-touch
    touchStartRef.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartRef.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartRef.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentWeekIndex > 0) {
        goToWeek(currentWeekIndex - 1);
      } else if (diff < 0 && currentWeekIndex < weekPages.length - 1) {
        goToWeek(currentWeekIndex + 1);
      }
    }
    touchStartRef.current = null;
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const currentWeek = weekPages[currentWeekIndex] ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <main className="mx-auto max-w-md px-4 py-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Programs</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLibrary(true)}
            >
              Library
            </Button>
            <Button size="sm" onClick={() => navigate("/programs/new")}>
              Create
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : !activeProgram || !activeEnrollment ? (
          <div className="py-12 text-center">
            <p className="text-lg font-semibold mb-2">No Active Program</p>
            <p className="text-muted-foreground text-sm mb-6">
              Activate a program from the library or create a new one.
            </p>
            <Button onClick={() => setShowLibrary(true)}>
              Browse Library
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Active program title + unenroll */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{activeProgram.name}</h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() =>
                  void handleToggleActive({
                    program: activeProgram,
                    enrollment: activeEnrollment,
                  })
                }
              >
                Unenroll
              </Button>
            </div>

            {/* Phase label (phased programs only) */}
            {currentWeek?.phaseLabel && (
              <div className="rounded-lg bg-primary/10 px-3 py-1.5 text-center">
                <p className="text-sm font-semibold text-primary">
                  {currentWeek.phaseLabel}
                </p>
              </div>
            )}

            {/* Week navigation */}
            {weekPages.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => goToWeek(currentWeekIndex - 1)}
                    disabled={currentWeekIndex === 0}
                    className="p-2 text-muted-foreground disabled:opacity-30"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span
                    className={`font-semibold text-sm ${
                      currentWeek?.label === "DELOAD"
                        ? "text-amber-600 dark:text-amber-400"
                        : ""
                    }`}
                  >
                    {currentWeek?.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => goToWeek(currentWeekIndex + 1)}
                    disabled={currentWeekIndex === weekPages.length - 1}
                    className="p-2 text-muted-foreground disabled:opacity-30"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>

                {/* Week dots */}
                {weekPages.length <= 12 && (
                  <div className="flex justify-center gap-1.5">
                    {weekPages.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => goToWeek(idx)}
                        className={`h-2 rounded-full transition-all ${
                          idx === currentWeekIndex
                            ? "w-6 bg-primary"
                            : "w-2 bg-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Workout grid (swipeable) */}
            <div
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="min-h-[160px]"
            >
              {currentWeek && currentWeek.workouts.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {currentWeek.workouts.map((workout) => {
                    const isSelected = selectedWorkoutId === workout.id;
                    const isNext =
                      !workout.isCompleted &&
                      workout.id ===
                        currentWeek.workouts.find((w) => !w.isCompleted)?.id;

                    return (
                      <button
                        key={workout.id}
                        type="button"
                        onClick={() => setSelectedWorkoutId(workout.id)}
                        className={`rounded-xl border-2 p-4 text-left transition-all ${
                          workout.isCompleted
                            ? "border-border bg-muted/50 opacity-60"
                            : isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30"
                        }`}
                      >
                        <p
                          className={`font-medium text-sm ${
                            workout.isCompleted ? "text-muted-foreground" : ""
                          }`}
                        >
                          {workout.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Day {workout.dayIndex + 1}
                        </p>
                        {workout.isCompleted && (
                          <div className="flex items-center gap-1 mt-2">
                            <Check className="h-3.5 w-3.5 text-green-500" />
                            <span className="text-xs text-green-600 dark:text-green-400">
                              Done
                            </span>
                          </div>
                        )}
                        {isNext && !isSelected && (
                          <span className="inline-block mt-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            Up next
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No workouts for this week.
                </p>
              )}
            </div>

            {/* Start Workout */}
            <Button
              className="min-h-[48px] w-full text-base font-semibold"
              onClick={handleStartWorkout}
              disabled={!selectedWorkoutId}
            >
              Go to Workout
            </Button>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Library Dialog                                                    */}
        {/* ---------------------------------------------------------------- */}
        <Dialog open={showLibrary} onOpenChange={setShowLibrary}>
          <DialogContent className="max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Program Library</DialogTitle>
              <DialogDescription>
                Manage your programs or activate a different one.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 overflow-y-auto flex-1">
              {allPrograms.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">
                  No programs yet. Create your first one.
                </p>
              ) : (
                allPrograms.map(({ program, enrollment }) => {
                  const isActive = enrollment?.is_active ?? false;
                  const isShared = program.user_id === null;

                  return (
                    <div
                      key={program.id}
                      className="rounded-lg border border-border p-3"
                    >
                      <div className="mb-2">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{program.name}</p>
                          {isActive && (
                            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {program.program_type === "phased"
                            ? `${phaseCounts[program.id] ?? 0} phase${(phaseCounts[program.id] ?? 0) !== 1 ? "s" : ""}`
                            : `${routineCounts[program.id] ?? 0} routine${(routineCounts[program.id] ?? 0) !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() =>
                            void handleToggleActive({ program, enrollment })
                          }
                        >
                          {isActive ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowLibrary(false);
                            navigate(`/programs/${program.id}`);
                          }}
                        >
                          {isShared || program.program_type === "phased"
                            ? "View"
                            : "Edit"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setDeleteTarget({ program, enrollment })
                          }
                        >
                          {isShared ? "Unenroll" : "Delete"}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
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
              <Button
                variant="destructive"
                onClick={() => void handleDelete()}
              >
                {deleteTarget?.program.user_id === null
                  ? "Unenroll"
                  : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
