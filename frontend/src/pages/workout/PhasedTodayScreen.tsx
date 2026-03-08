import { useState, useEffect } from "react";
import {
  db,
  type DbProgram,
  type DbUserProgram,
  type DbProgramPhase,
  type DbPhaseWorkout,
  type DbPhaseWorkoutSection,
  type DbPhaseWorkoutExercise,
  type DbExercise,
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

interface PhasedTodayScreenProps {
  program: DbProgram;
  enrollment: DbUserProgram;
  onStartWorkout: (
    phaseWorkoutId: string,
    programId: string,
    workoutName: string,
  ) => void;
  onAdHoc: () => void;
}

interface SectionWithExercises {
  section: DbPhaseWorkoutSection;
  exercises: (DbPhaseWorkoutExercise & {
    exerciseName: string;
    equipment: string | null;
    lastWeight: number | null;
    sub1Name: string | null;
    sub2Name: string | null;
  })[];
}

export function PhasedTodayScreen({
  program,
  enrollment,
  onStartWorkout,
  onAdHoc,
}: PhasedTodayScreenProps) {
  const [phase, setPhase] = useState<DbProgramPhase | null>(null);
  const [workout, setWorkout] = useState<DbPhaseWorkout | null>(null);
  const [sectionGroups, setSectionGroups] = useState<SectionWithExercises[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const phaseIdx = enrollment.current_phase_index;
  const weekInPhase = enrollment.current_week_in_phase;
  const dayIdx = enrollment.current_day_index;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Load phases for this program
      const phases = await db.programPhases
        .where("program_id")
        .equals(program.id)
        .toArray();
      phases.sort((a, b) => a.order - b.order);

      if (cancelled || phases.length === 0) {
        setIsLoading(false);
        return;
      }

      const currentPhase = phases[phaseIdx % phases.length];
      setPhase(currentPhase);

      // week_number is 1-indexed
      const weekNum = (weekInPhase % currentPhase.duration_weeks) + 1;
      const currentDayIdx = dayIdx % 3;

      // Find the workout matching phase + week + day
      const workouts = await db.phaseWorkouts
        .where("[phase_id+day_index+week_number]")
        .equals([currentPhase.id, currentDayIdx, weekNum])
        .toArray();

      const currentWorkout = workouts[0] ?? null;
      setWorkout(currentWorkout);

      if (!currentWorkout) {
        setIsLoading(false);
        return;
      }

      // Load sections
      const sections = await db.phaseWorkoutSections
        .where("workout_id")
        .equals(currentWorkout.id)
        .toArray();
      sections.sort((a, b) => a.order - b.order);

      // Load all exercises for these sections
      const sectionIds = sections.map((s) => s.id);
      const allPWEs = sectionIds.length > 0
        ? await db.phaseWorkoutExercises
            .where("section_id")
            .anyOf(sectionIds)
            .toArray()
        : [];

      // Look up exercise details
      const exerciseIds = [
        ...new Set([
          ...allPWEs.map((e) => e.exercise_id),
          ...allPWEs.map((e) => e.substitute1_exercise_id).filter(Boolean) as string[],
          ...allPWEs.map((e) => e.substitute2_exercise_id).filter(Boolean) as string[],
        ]),
      ];
      const exercisesData =
        exerciseIds.length > 0
          ? await db.exercises.where("id").anyOf(exerciseIds).toArray()
          : [];
      const exMap = new Map<string, DbExercise>(
        exercisesData.map((e) => [e.id, e]),
      );

      // Look up progress for last weights
      const allProgress =
        exerciseIds.length > 0
          ? await db.exerciseProgress
              .where("exercise_id")
              .anyOf(exerciseIds)
              .toArray()
          : [];
      const maxWeightMap = new Map<string, number>();
      for (const p of allProgress) {
        const cur = maxWeightMap.get(p.exercise_id) ?? 0;
        if (p.max_weight > cur) maxWeightMap.set(p.exercise_id, p.max_weight);
      }

      const groups: SectionWithExercises[] = sections.map((section) => {
        const sectionExercises = allPWEs
          .filter((e) => e.section_id === section.id)
          .sort((a, b) => a.order - b.order)
          .map((pwe) => ({
            ...pwe,
            exerciseName: exMap.get(pwe.exercise_id)?.name ?? "Unknown",
            equipment: exMap.get(pwe.exercise_id)?.equipment ?? null,
            lastWeight: maxWeightMap.get(pwe.exercise_id) ?? null,
            sub1Name: pwe.substitute1_exercise_id
              ? exMap.get(pwe.substitute1_exercise_id)?.name ?? null
              : null,
            sub2Name: pwe.substitute2_exercise_id
              ? exMap.get(pwe.substitute2_exercise_id)?.name ?? null
              : null,
          }));
        return { section, exercises: sectionExercises };
      });

      if (!cancelled) {
        setSectionGroups(groups);
        setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [program.id, phaseIdx, weekInPhase, dayIdx]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const weekNum = phase
    ? (weekInPhase % phase.duration_weeks) + 1
    : weekInPhase + 1;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{program.name}</h1>

      {/* Phase/Week/Day indicator */}
      <div className="rounded-lg bg-primary/10 px-4 py-2 text-center">
        <p className="text-sm font-semibold text-primary">
          Phase {phaseIdx + 1}: {phase?.name ?? "Unknown"}
        </p>
        <p className="text-xs text-muted-foreground">
          Week {weekNum} &mdash; Day {(dayIdx % 3) + 1}
        </p>
      </div>

      {phase?.description && (
        <p className="text-sm text-muted-foreground text-center italic">
          {phase.description}
        </p>
      )}

      {/* Workout preview */}
      {workout && sectionGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{workout.name}</CardTitle>
            <CardDescription>
              {sectionGroups.reduce((n, g) => n + g.exercises.length, 0)} exercises
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {sectionGroups.map((group) => (
              <div key={group.section.id}>
                <div className="mb-2">
                  <p className="text-sm font-semibold">{group.section.name}</p>
                  {group.section.notes && (
                    <p className="text-xs text-muted-foreground">
                      {group.section.notes}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {group.exercises.map((ex) => {
                    const warmupGuidance =
                      ex.warmup_sets > 0
                        ? calculateWarmupSets(ex.warmup_sets, ex.lastWeight)
                        : null;

                    return (
                      <div
                        key={ex.id}
                        className="rounded-md border border-border p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">
                              {ex.exerciseName}
                            </p>
                            {ex.equipment && (
                              <p className="text-xs text-muted-foreground">
                                {ex.equipment}
                              </p>
                            )}
                          </div>
                          {ex.lastWeight !== null && (
                            <span className="text-xs text-muted-foreground">
                              Last: {ex.lastWeight} kg
                            </span>
                          )}
                        </div>

                        {(ex.sub1Name || ex.sub2Name) && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                              SUB
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {[ex.sub1Name, ex.sub2Name]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            {ex.working_sets}x{ex.reps_display}
                            {ex.rest_period && `, Rest: ${ex.rest_period}`}
                          </span>
                          {ex.intensity_technique && (
                            <span className="inline-block rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
                              {ex.intensity_technique}
                            </span>
                          )}
                        </div>

                        {warmupGuidance && (
                          <div className="mt-2 flex flex-col gap-1">
                            <p className="text-xs text-muted-foreground">
                              Warmup ({ex.warmup_sets} sets)
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
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!workout && (
        <p className="text-center text-muted-foreground py-8">
          No workout found for this day.
        </p>
      )}

      {/* Start button */}
      <Button
        className="min-h-[48px] text-base font-semibold"
        onClick={() => {
          if (workout) {
            onStartWorkout(workout.id, program.id, workout.name);
          }
        }}
        disabled={!workout}
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
