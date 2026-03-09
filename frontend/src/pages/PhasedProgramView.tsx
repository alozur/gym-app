import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  db,
  type DbProgram,
  type DbUserProgram,
  type DbProgramPhase,
  type DbPhaseWorkout,
  type DbPhaseWorkoutSection,
  type DbPhaseWorkoutExercise,
} from "@/db/index";
import { useAuthContext } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ChevronLeft, ChevronDown, ChevronRight } from "lucide-react";

interface SectionWithExercises {
  section: DbPhaseWorkoutSection;
  exercises: (DbPhaseWorkoutExercise & { exerciseName: string })[];
}

interface WorkoutWithSections {
  workout: DbPhaseWorkout;
  sections: SectionWithExercises[];
}

export default function PhasedProgramView() {
  const navigate = useNavigate();
  const { id: programId } = useParams<{ id: string }>();
  const { state: authState } = useAuthContext();
  const userId = authState.user?.id ?? "";

  const [program, setProgram] = useState<DbProgram | null>(null);
  const [enrollment, setEnrollment] = useState<DbUserProgram | null>(null);
  const [phases, setPhases] = useState<DbProgramPhase[]>([]);
  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState(0);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [weekWorkouts, setWeekWorkouts] = useState<WorkoutWithSections[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProgram = useCallback(async () => {
    if (!programId) return;
    const prog = await db.programs.get(programId);
    if (!prog) return;
    setProgram(prog);

    const allPhases = await db.programPhases
      .where("program_id")
      .equals(programId)
      .toArray();
    allPhases.sort((a, b) => a.order - b.order);
    setPhases(allPhases);

    // Load enrollment for "Current" badge
    if (userId) {
      const enrollments = await db.userPrograms
        .where("user_id")
        .equals(userId)
        .toArray();
      const match = enrollments.find(
        (e) => e.program_id === programId && e.is_active,
      );
      setEnrollment(match ?? null);
    }

    setIsLoading(false);
  }, [programId, userId]);

  useEffect(() => {
    void loadProgram();
  }, [loadProgram]);

  // Load workouts when a week is expanded
  const loadWeekWorkouts = useCallback(
    async (phaseId: string, weekNumber: number) => {
      const workouts = await db.phaseWorkouts
        .where("[phase_id+week_number+day_index]")
        .between([phaseId, weekNumber, 0], [phaseId, weekNumber, 99])
        .toArray();
      workouts.sort((a, b) => a.day_index - b.day_index);

      // Build exercise name cache
      const exerciseCache = new Map<string, string>();
      const getExerciseName = async (id: string): Promise<string> => {
        if (exerciseCache.has(id)) return exerciseCache.get(id)!;
        const ex = await db.exercises.get(id);
        const name = ex?.name ?? "Unknown";
        exerciseCache.set(id, name);
        return name;
      };

      const result: WorkoutWithSections[] = [];
      for (const workout of workouts) {
        const sections = await db.phaseWorkoutSections
          .where("workout_id")
          .equals(workout.id)
          .toArray();
        sections.sort((a, b) => a.order - b.order);

        const sectionsWithExercises: SectionWithExercises[] = [];
        for (const section of sections) {
          const exercises = await db.phaseWorkoutExercises
            .where("section_id")
            .equals(section.id)
            .toArray();
          exercises.sort((a, b) => a.order - b.order);

          const exercisesWithNames = await Promise.all(
            exercises.map(async (ex) => ({
              ...ex,
              exerciseName: await getExerciseName(ex.exercise_id),
            })),
          );

          sectionsWithExercises.push({
            section,
            exercises: exercisesWithNames,
          });
        }

        result.push({ workout, sections: sectionsWithExercises });
      }

      setWeekWorkouts(result);
    },
    [],
  );

  function handleWeekToggle(weekNumber: number) {
    if (expandedWeek === weekNumber) {
      setExpandedWeek(null);
      setWeekWorkouts([]);
    } else {
      setExpandedWeek(weekNumber);
      const phase = phases[selectedPhaseIndex];
      if (phase) {
        void loadWeekWorkouts(phase.id, weekNumber);
      }
    }
  }

  function handlePhaseChange(index: number) {
    setSelectedPhaseIndex(index);
    setExpandedWeek(null);
    setWeekWorkouts([]);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-28">
        <main className="mx-auto max-w-md px-4 py-6">
          <p className="text-muted-foreground">Program not found</p>
        </main>
      </div>
    );
  }

  const currentPhase = phases[selectedPhaseIndex];

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <main className="mx-auto max-w-md px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/programs")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{program.name}</h1>
            <p className="text-sm text-muted-foreground">
              {phases.length} phases
            </p>
          </div>
        </div>

        {/* Phase tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {phases.map((phase, index) => (
            <button
              key={phase.id}
              onClick={() => handlePhaseChange(index)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                index === selectedPhaseIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Phase {index + 1}
            </button>
          ))}
        </div>

        {/* Phase info */}
        {currentPhase && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>{currentPhase.name}</CardTitle>
              <CardDescription>
                {currentPhase.duration_weeks} weeks
                {currentPhase.description && (
                  <span> &mdash; {currentPhase.description}</span>
                )}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Week list */}
        {currentPhase && (
          <div className="flex flex-col gap-2">
            {Array.from(
              { length: currentPhase.duration_weeks },
              (_, i) => i + 1,
            ).map((weekNum) => {
              const isExpanded = expandedWeek === weekNum;
              const isCurrent =
                enrollment !== null &&
                enrollment.current_phase_index === selectedPhaseIndex &&
                enrollment.current_week_in_phase + 1 === weekNum;

              return (
                <div key={weekNum}>
                  <button
                    onClick={() => handleWeekToggle(weekNum)}
                    className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                      isCurrent
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Week {weekNum}</span>
                      {isCurrent && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          Current
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {/* Expanded week content */}
                  {isExpanded && (
                    <div className="mt-2 flex flex-col gap-3 pl-2">
                      {weekWorkouts.map((ww) => (
                        <Card key={ww.workout.id}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-base">
                              {ww.workout.name}
                            </CardTitle>
                          </CardHeader>
                          <div className="px-6 pb-4">
                            {ww.sections.map((sw) => (
                              <div key={sw.section.id} className="mb-3 last:mb-0">
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  {sw.section.name}
                                </p>
                                {sw.section.notes && (
                                  <p className="mb-1 text-xs text-muted-foreground italic">
                                    {sw.section.notes}
                                  </p>
                                )}
                                <ul className="space-y-0.5">
                                  {sw.exercises.map((ex) => (
                                    <li
                                      key={ex.id}
                                      className="flex items-baseline justify-between text-sm"
                                    >
                                      <span>{ex.exerciseName}</span>
                                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                                        {ex.working_sets}x{ex.reps_display}
                                        {ex.rest_period && (
                                          <span className="ml-1">
                                            ({ex.rest_period})
                                          </span>
                                        )}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </Card>
                      ))}
                      {weekWorkouts.length === 0 && (
                        <p className="py-2 text-center text-sm text-muted-foreground">
                          Loading...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
