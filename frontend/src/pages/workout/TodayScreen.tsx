import { useState, useEffect } from "react";
import {
  db,
  type DbTemplateExercise,
  type DbExercise,
  type DbWorkoutTemplate,
  type DbProgram,
  type DbProgramRoutine,
} from "@/db/index";
import { calculateWarmupSets } from "@/utils/warmup";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import type { WeekType } from "./types";

interface TodayScreenProps {
  program: DbProgram;
  onStartWorkout: (
    templateId: string,
    weekType: WeekType,
    templateName: string | null,
    programId: string,
  ) => void;
  onAdHoc: () => void;
}

interface RoutineInfo {
  routine: DbProgramRoutine;
  template: DbWorkoutTemplate | null;
  exerciseCount: number;
  exerciseNames: string[];
}

export function TodayScreen({ program, onStartWorkout, onAdHoc }: TodayScreenProps) {
  const [routineInfos, setRoutineInfos] = useState<RoutineInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedExercises, setSelectedExercises] = useState<DbTemplateExercise[]>([]);
  const [exerciseMap, setExerciseMap] = useState<Map<string, DbExercise>>(new Map());
  const [progressMap, setProgressMap] = useState<Map<string, number>>(new Map());
  const [subNamesMap, setSubNamesMap] = useState<Map<string, string[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const isDeload =
    program.weeks_completed % program.deload_every_n_weeks ===
    program.deload_every_n_weeks - 1;
  const weekType: WeekType = isDeload ? "deload" : "normal";
  const weekNumber =
    (program.weeks_completed % program.deload_every_n_weeks) + 1;

  // The "last done" routine is the one before current_routine_index (wrapping)
  const lastDoneIndex =
    routineInfos.length > 0
      ? (program.current_routine_index - 1 + routineInfos.length) % routineInfos.length
      : -1;

  // Load all routines and their template info
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const allRoutines = await db.programRoutines
        .where("program_id")
        .equals(program.id)
        .toArray();
      allRoutines.sort((a, b) => a.order - b.order);

      if (cancelled || allRoutines.length === 0) {
        setIsLoading(false);
        return;
      }

      const infos: RoutineInfo[] = [];
      for (const routine of allRoutines) {
        const template = await db.workoutTemplates.get(routine.template_id) ?? null;

        // Count exercises for this template in the current week type (main only)
        const allTexercises = template
          ? await db.templateExercises
              .where("template_id")
              .equals(template.id)
              .and((te) => te.week_type === weekType)
              .toArray()
          : [];
        const texercises = allTexercises.filter((te) => !te.parent_exercise_id);

        // Get exercise names for preview
        const exerciseIds = texercises.map((te) => te.exercise_id);
        const exercises =
          exerciseIds.length > 0
            ? await db.exercises.where("id").anyOf(exerciseIds).toArray()
            : [];
        const nameMap = new Map(exercises.map((e) => [e.id, e.name]));
        const names = texercises
          .sort((a, b) => a.order - b.order)
          .map((te) => nameMap.get(te.exercise_id) ?? "Unknown");

        infos.push({
          routine,
          template,
          exerciseCount: texercises.length,
          exerciseNames: names,
        });
      }

      if (!cancelled) {
        setRoutineInfos(infos);
        // Auto-select the suggested next routine
        setSelectedIndex(program.current_routine_index < infos.length ? program.current_routine_index : 0);
        setIsLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [program, weekType]);

  // When a routine is selected, load its full exercise details
  useEffect(() => {
    if (selectedIndex === null || selectedIndex >= routineInfos.length) return;
    let cancelled = false;

    async function loadExercises() {
      const info = routineInfos[selectedIndex!];
      if (!info.template) return;

      const allTEs = await db.templateExercises
        .where("template_id")
        .equals(info.template.id)
        .and((te) => te.week_type === weekType)
        .sortBy("order");

      // Separate main from substitute TEs
      const mainTEs = allTEs.filter((te) => !te.parent_exercise_id);
      const childTEs = allTEs.filter((te) => !!te.parent_exercise_id);

      if (cancelled) return;
      setSelectedExercises(mainTEs);

      // Collect ALL exercise IDs (main + subs) for lookup
      const allExerciseIds = [...new Set(allTEs.map((te) => te.exercise_id))];
      if (allExerciseIds.length > 0) {
        const exercises = await db.exercises.where("id").anyOf(allExerciseIds).toArray();
        if (cancelled) return;
        const exMap = new Map(exercises.map((e) => [e.id, e]));
        setExerciseMap(exMap);

        // Build sub names map: main TE id -> substitute exercise names
        const subNames = new Map<string, string[]>();
        if (childTEs.length > 0) {
          // New format: child TEs with parent_exercise_id
          for (const child of childTEs) {
            const parentId = child.parent_exercise_id!;
            const arr = subNames.get(parentId) ?? [];
            const subEx = exMap.get(child.exercise_id);
            if (subEx) arr.push(subEx.name);
            subNames.set(parentId, arr);
          }
        } else {
          // Fallback: old exerciseSubstitutions table
          const mainExIds = mainTEs.map((te) => te.exercise_id);
          const oldSubs = await db.exerciseSubstitutions
            .where("exercise_id")
            .anyOf(mainExIds)
            .toArray();
          if (oldSubs.length > 0) {
            const oldSubExIds = [...new Set(oldSubs.map((s) => s.substitute_exercise_id))];
            const oldSubExData = await db.exercises.where("id").anyOf(oldSubExIds).toArray();
            const oldSubExMap = new Map(oldSubExData.map((e) => [e.id, e]));
            for (const te of mainTEs) {
              const subs = oldSubs.filter((s) => s.exercise_id === te.exercise_id);
              if (subs.length > 0) {
                subNames.set(
                  te.id,
                  subs
                    .map((s) => oldSubExMap.get(s.substitute_exercise_id)?.name)
                    .filter((n): n is string => !!n),
                );
              }
            }
          }
        }
        setSubNamesMap(subNames);

        const allProgress = await db.exerciseProgress
          .where("exercise_id")
          .anyOf(allExerciseIds)
          .toArray();
        const maxWeights = new Map<string, number>();
        for (const p of allProgress) {
          const current = maxWeights.get(p.exercise_id) ?? 0;
          if (p.max_weight > current) maxWeights.set(p.exercise_id, p.max_weight);
        }
        if (!cancelled) setProgressMap(maxWeights);
      }
    }

    void loadExercises();
    return () => { cancelled = true; };
  }, [selectedIndex, routineInfos, weekType]);

  function handleStart() {
    if (selectedIndex === null) return;
    const info = routineInfos[selectedIndex];
    if (!info?.template) return;

    onStartWorkout(
      info.routine.template_id,
      weekType,
      info.template.name,
      program.id,
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const selectedInfo = selectedIndex !== null ? routineInfos[selectedIndex] : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{program.name}</h1>

      {/* Week indicator */}
      <div
        className={`rounded-lg px-4 py-2 text-center font-semibold ${
          isDeload
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            : "bg-primary/10 text-primary"
        }`}
      >
        {isDeload
          ? "DELOAD WEEK"
          : `Week ${weekNumber} of ${program.deload_every_n_weeks}`}
      </div>

      {/* All routines */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Select a routine</p>
        {routineInfos.map((info, index) => {
          const isSelected = selectedIndex === index;
          const isNext = index === program.current_routine_index;
          const isLastDone = index === lastDoneIndex && program.last_workout_at !== null;

          return (
            <button
              key={info.routine.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">
                  {info.template?.name ?? "Unknown Template"}
                </span>
                <div className="flex items-center gap-1.5">
                  {isLastDone && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Last done
                    </span>
                  )}
                  {isNext && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Up next
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {info.exerciseCount} exercise{info.exerciseCount !== 1 ? "s" : ""}
                {info.exerciseNames.length > 0 && (
                  <> &mdash; {info.exerciseNames.slice(0, 3).join(", ")}
                    {info.exerciseNames.length > 3 && `, +${info.exerciseNames.length - 3} more`}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected routine exercise details */}
      {selectedInfo?.template && selectedExercises.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selectedInfo.template.name}</CardTitle>
            <CardDescription>
              {selectedExercises.length} exercise{selectedExercises.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {selectedExercises.map((te) => {
              const ex = exerciseMap.get(te.exercise_id);
              const lastWeight = progressMap.get(te.exercise_id) ?? null;
              const warmupGuidance =
                te.warmup_sets > 0
                  ? calculateWarmupSets(te.warmup_sets, lastWeight)
                  : null;
              const subs = subNamesMap.get(te.id) ?? [];

              return (
                <div
                  key={te.id}
                  className="rounded-md border border-border p-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {ex?.name ?? "Unknown"}
                      </p>
                      {ex?.equipment && (
                        <p className="text-xs text-muted-foreground">
                          {ex.equipment}
                        </p>
                      )}
                    </div>
                    {lastWeight !== null && (
                      <span className="text-xs text-muted-foreground">
                        Last: {lastWeight} kg
                      </span>
                    )}
                  </div>

                  {subs.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                        SUB
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {subs.join(", ")}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {te.working_sets}x{te.min_reps}-{te.max_reps} @ RPE{" "}
                      {te.early_set_rpe_min}-{te.last_set_rpe_max}, Rest:{" "}
                      {te.rest_period}
                    </span>
                    {te.intensity_technique && (
                      <span className="inline-block rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
                        {te.intensity_technique}
                      </span>
                    )}
                  </div>

                  {warmupGuidance && (
                    <div className="mt-2 flex flex-col gap-1">
                      <p className="text-xs text-muted-foreground">
                        Warmup ({te.warmup_sets} sets)
                      </p>
                      {warmupGuidance.map((ws) => (
                        <div
                          key={ws.setNumber}
                          className="flex items-center gap-3 text-xs text-muted-foreground"
                        >
                          <span>{ws.weight} kg</span>
                          <span>&times; {ws.reps} reps</span>
                          <span>({ws.percentage}%)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Start button */}
      <Button
        className="min-h-[48px] text-base font-semibold"
        onClick={handleStart}
        disabled={selectedIndex === null || !selectedInfo?.template}
      >
        Start Workout
      </Button>

      {/* Ad-hoc link */}
      <button
        type="button"
        className="text-sm text-muted-foreground underline text-center"
        onClick={onAdHoc}
      >
        Ad-hoc Workout
      </button>
    </div>
  );
}
