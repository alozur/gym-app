import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import {
  db,
  SYNC_STATUS,
  type DbTemplateExercise,
  type DbExercise,
  type DbWorkoutSession,
  type DbExerciseSubstitution,
} from "@/db/index";
import { useAuthContext } from "@/context/AuthContext";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExercisePicker } from "@/components/ExercisePicker";
import { ExerciseCard } from "./ExerciseCard";
import { getYearWeek } from "./types";
import type {
  ExerciseEntry,
  SetEntry,
  SubstituteExercise,
} from "./types";

interface ActiveWorkoutProps {
  session: DbWorkoutSession;
  templateName: string | null;
  onFinished?: () => void;
}

export function ActiveWorkout({ session, templateName, onFinished }: ActiveWorkoutProps) {
  const navigate = useNavigate();
  const { state: authState } = useAuthContext();
  const userId = authState.user?.id ?? "";

  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const existingExerciseIds = useMemo(
    () => exercises.map((e) => e.exerciseId),
    [exercises]
  );

  // Load template exercises or empty for ad-hoc
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!session.template_id) {
        setIsLoading(false);
        return;
      }

      // Load ALL template exercises for this template + week type
      const allTEs = await db.templateExercises
        .where("template_id")
        .equals(session.template_id)
        .and((te) => te.week_type === session.week_type)
        .sortBy("order");

      // Separate main (no parent) from substitute TEs
      const mainTEs = allTEs.filter((te) => !te.parent_exercise_id);
      const subTEs = allTEs.filter((te) => !!te.parent_exercise_id);

      // Group substitute TEs by parent_exercise_id
      const subsByParent = new Map<string, DbTemplateExercise[]>();
      for (const te of subTEs) {
        const arr = subsByParent.get(te.parent_exercise_id!) ?? [];
        arr.push(te);
        subsByParent.set(te.parent_exercise_id!, arr);
      }

      // Collect all exercise IDs we need to look up
      const allExerciseIds = [...new Set(allTEs.map((te) => te.exercise_id))];
      const exercisesData = await db.exercises
        .where("id")
        .anyOf(allExerciseIds)
        .toArray();
      const exerciseMap = new Map(exercisesData.map((e) => [e.id, e]));

      // Look up last max weights for warmup guidance
      const allProgress = await db.exerciseProgress
        .where("exercise_id")
        .anyOf(allExerciseIds)
        .toArray();
      const maxWeightMap = new Map<string, number>();
      for (const p of allProgress) {
        const current = maxWeightMap.get(p.exercise_id) ?? 0;
        if (p.max_weight > current) {
          maxWeightMap.set(p.exercise_id, p.max_weight);
        }
      }

      // For fallback: load old exerciseSubstitutions
      const mainExerciseIds = mainTEs.map((te) => te.exercise_id);
      const allOldSubs = await db.exerciseSubstitutions
        .where("exercise_id")
        .anyOf(mainExerciseIds)
        .toArray();
      const oldSubsMap = new Map<string, DbExerciseSubstitution[]>();
      for (const s of allOldSubs) {
        const arr = oldSubsMap.get(s.exercise_id) ?? [];
        arr.push(s);
        oldSubsMap.set(s.exercise_id, arr);
      }

      // Eagerly fetch exercise data for old-format substitutes
      const oldSubExIds = [...new Set(allOldSubs.map((s) => s.substitute_exercise_id))];
      const oldSubExData = oldSubExIds.length > 0
        ? await db.exercises.where("id").anyOf(oldSubExIds).toArray()
        : [];
      const oldSubExMap = new Map(oldSubExData.map((e) => [e.id, e]));

      const entries: ExerciseEntry[] = mainTEs.map((te) => {
        const ex = exerciseMap.get(te.exercise_id);

        // Build substitute slides from new-format TEs
        const childTEs = subsByParent.get(te.id) ?? [];
        let substituteSlides: SubstituteExercise[];

        if (childTEs.length > 0) {
          // New format: each child TE carries its own prescription
          substituteSlides = childTEs.map((childTE) => {
            const subEx = exerciseMap.get(childTE.exercise_id);
            return {
              id: childTE.exercise_id,
              name: subEx?.name ?? "Unknown",
              equipment: subEx?.equipment ?? null,
              youtubeUrl: subEx?.youtube_url ?? null,
              notes: subEx?.notes ?? null,
              prescription: childTE,
              lastMaxWeight: maxWeightMap.get(childTE.exercise_id) ?? null,
            };
          });
        } else {
          // Fallback: old exerciseSubstitutions (no per-sub prescription)
          const oldSubs = oldSubsMap.get(te.exercise_id) ?? [];
          substituteSlides = oldSubs.map((s) => {
            const subEx = oldSubExMap.get(s.substitute_exercise_id);
            return {
              id: s.substitute_exercise_id,
              name: subEx?.name ?? "Unknown",
              equipment: subEx?.equipment ?? null,
              youtubeUrl: subEx?.youtube_url ?? null,
              notes: subEx?.notes ?? null,
              prescription: null,
              lastMaxWeight: maxWeightMap.get(s.substitute_exercise_id) ?? null,
            };
          });
        }

        const workingSets: SetEntry[] = Array.from(
          { length: te.working_sets },
          (_, i) => ({
            id: uuidv4(),
            setType: "working" as const,
            setNumber: i + 1,
            weight: "",
            reps: "",
            rpe: "",
            saved: false,
          })
        );

        return {
          prescriptionId: te.id,
          exerciseId: te.exercise_id,
          exerciseName: ex?.name ?? "Unknown Exercise",
          equipment: ex?.equipment ?? null,
          youtubeUrl: ex?.youtube_url ?? null,
          exerciseNotes: ex?.notes ?? null,
          prescription: te,
          lastMaxWeight: maxWeightMap.get(te.exercise_id) ?? null,
          warmupCount: te.warmup_sets,
          workingSets,
          substitutions: oldSubsMap.get(te.exercise_id) ?? [],
          substituteExercises: [
            {
              id: te.exercise_id,
              name: ex?.name ?? "Unknown Exercise",
              equipment: ex?.equipment ?? null,
              youtubeUrl: ex?.youtube_url ?? null,
              notes: ex?.notes ?? null,
              prescription: te,
              lastMaxWeight: maxWeightMap.get(te.exercise_id) ?? null,
            },
            ...substituteSlides,
          ],
        };
      });

      if (!cancelled) {
        setExercises(entries);
        setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [session.template_id, session.week_type]);

  const handleUpdateSets = useCallback(
    (exerciseId: string, _setType: "working", sets: SetEntry[]) => {
      setExercises((prev) =>
        prev.map((e) => {
          if (e.exerciseId !== exerciseId) return e;
          return { ...e, workingSets: sets };
        })
      );
    },
    []
  );

  const handleSubstitute = useCallback(
    (
      oldExerciseId: string,
      newExercise: SubstituteExercise,
    ) => {
      setExercises((prev) =>
        prev.map((e) => {
          if (e.exerciseId !== oldExerciseId) return e;

          const newRx = newExercise.prescription;
          const newWarmup = newRx?.warmup_sets ?? e.warmupCount;
          const newSetCount = newRx?.working_sets ?? e.workingSets.length;

          // Regenerate working sets if count changed, otherwise just reset saved flags
          let workingSets: SetEntry[];
          if (newSetCount !== e.workingSets.length) {
            workingSets = Array.from({ length: newSetCount }, (_, i) => ({
              id: uuidv4(),
              setType: "working" as const,
              setNumber: i + 1,
              weight: "",
              reps: "",
              rpe: "",
              saved: false,
            }));
          } else {
            workingSets = e.workingSets.map((s) => ({ ...s, saved: false }));
          }

          return {
            ...e,
            exerciseId: newExercise.id,
            exerciseName: newExercise.name,
            equipment: newExercise.equipment,
            youtubeUrl: newExercise.youtubeUrl,
            exerciseNotes: newExercise.notes,
            prescription: newRx ?? e.prescription,
            lastMaxWeight: newExercise.lastMaxWeight,
            warmupCount: newWarmup,
            workingSets,
          };
        })
      );
    },
    []
  );

  async function handleAddExercise(ex: DbExercise) {
    // Look up last max weight for warmup guidance
    const progressRecords = await db.exerciseProgress
      .where("exercise_id")
      .equals(ex.id)
      .toArray();
    const lastMaxWeight = progressRecords.length > 0
      ? Math.max(...progressRecords.map((p) => p.max_weight))
      : null;

    const newEntry: ExerciseEntry = {
      prescriptionId: null,
      exerciseId: ex.id,
      exerciseName: ex.name,
      equipment: ex.equipment,
      youtubeUrl: ex.youtube_url,
      exerciseNotes: ex.notes,
      prescription: null,
      lastMaxWeight,
      warmupCount: lastMaxWeight ? 2 : 0,
      workingSets: [
        {
          id: uuidv4(),
          setType: "working",
          setNumber: 1,
          weight: "",
          reps: "",
          rpe: "",
          saved: false,
        },
      ],
      substitutions: [],
      substituteExercises: [{
        id: ex.id,
        name: ex.name,
        equipment: ex.equipment,
        youtubeUrl: ex.youtube_url,
        notes: ex.notes,
        prescription: null,
        lastMaxWeight,
      }],
    };
    setExercises((prev) => [...prev, newEntry]);
    setShowExercisePicker(false);
  }

  function handleAddWorkingSet(exerciseId: string) {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.exerciseId !== exerciseId) return e;
        const newSet: SetEntry = {
          id: uuidv4(),
          setType: "working",
          setNumber: e.workingSets.length + 1,
          weight: "",
          reps: "",
          rpe: "",
          saved: false,
        };
        return { ...e, workingSets: [...e.workingSets, newSet] };
      })
    );
  }

  async function handleFinishWorkout() {
    setIsFinishing(true);
    const finishedAt = new Date().toISOString();

    await db.workoutSessions.update(session.id, {
      finished_at: finishedAt,
      sync_status: SYNC_STATUS.pending,
    });

    // Calculate and save exercise_progress
    for (const entry of exercises) {
      const workingSets = await db.workoutSets
        .where("session_id")
        .equals(session.id)
        .and(
          (s) =>
            s.exercise_id === entry.exerciseId && s.set_type === "working"
        )
        .toArray();

      if (workingSets.length === 0) continue;

      const maxWeight = Math.max(...workingSets.map((s) => s.weight));
      const yearWeek = session.year_week ?? getYearWeek(new Date());

      // Check for existing progress record
      const existing = await db.exerciseProgress
        .where("[user_id+exercise_id+year_week]")
        .equals([userId, entry.exerciseId, yearWeek])
        .first();

      const progressRecord = {
        id: existing?.id ?? uuidv4(),
        user_id: userId,
        exercise_id: entry.exerciseId,
        year_week: yearWeek,
        max_weight: existing
          ? Math.max(existing.max_weight, maxWeight)
          : maxWeight,
        created_at: existing?.created_at ?? new Date().toISOString(),
        sync_status: SYNC_STATUS.pending,
      };

      await db.exerciseProgress.put(progressRecord);
    }

    // Advance program if this session is part of one
    if (session.program_id) {
      const program = await db.programs.get(session.program_id);
      if (program) {
        const routineCount = await db.programRoutines
          .where("program_id")
          .equals(program.id)
          .count();

        let newIndex = program.current_routine_index + 1;
        let newWeeksCompleted = program.weeks_completed;

        if (newIndex >= routineCount) {
          newIndex = 0;
          newWeeksCompleted = program.weeks_completed + 1;
        }

        await db.programs.update(program.id, {
          current_routine_index: newIndex,
          weeks_completed: newWeeksCompleted,
          last_workout_at: finishedAt,
          sync_status: SYNC_STATUS.pending,
        });

        if (navigator.onLine) {
          try {
            await api.post(`/programs/${program.id}/advance`);
          } catch {
            // Will sync later
          }
        }
      }
    }

    setIsFinishing(false);
    if (onFinished) {
      onFinished();
    } else {
      navigate("/", { replace: true });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">
          {templateName ?? "Ad-hoc Workout"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {session.week_type === "deload" ? "Deload" : "Normal"} Week
          {session.year_week && ` - ${session.year_week}`}
        </p>
      </div>

      {exercises.map((entry) => (
        <div key={entry.prescriptionId ?? entry.exerciseId} className="flex flex-col gap-2">
          <ExerciseCard
            entry={entry}
            sessionId={session.id}
            onUpdateSets={handleUpdateSets}
            onSubstitute={handleSubstitute}
          />
          {!entry.prescription && (
            <Button
              variant="ghost"
              size="sm"
              className="self-end min-h-[36px]"
              onClick={() => handleAddWorkingSet(entry.exerciseId)}
              type="button"
            >
              + Add Working Set
            </Button>
          )}
        </div>
      ))}

      {/* Ad-hoc: add exercise button */}
      {!session.template_id && (
        <Button
          variant="outline"
          className="min-h-[48px]"
          onClick={() => setShowExercisePicker(true)}
          type="button"
        >
          + Add Exercise
        </Button>
      )}

      {/* Finish Workout */}
      <Button
        className="w-full min-h-[48px] text-base font-semibold mt-4"
        onClick={() => void handleFinishWorkout()}
        disabled={isFinishing}
        type="button"
      >
        {isFinishing ? "Finishing..." : "Finish Workout"}
      </Button>

      {/* Exercise picker for ad-hoc */}
      <Dialog
        open={showExercisePicker}
        onOpenChange={(v) => !v && setShowExercisePicker(false)}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Exercise</DialogTitle>
          </DialogHeader>
          <ExercisePicker
            onSelect={handleAddExercise}
            excludeIds={existingExerciseIds}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
