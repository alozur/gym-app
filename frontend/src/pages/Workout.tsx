import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import {
  db,
  SYNC_STATUS,
  type DbWorkoutTemplate,
  type DbTemplateExercise,
  type DbExercise,
  type DbWorkoutSession,
  type DbWorkoutSet,
  type DbExerciseSubstitution,
  type DbProgram,
  type DbProgramRoutine,
} from "@/db/index";
import { calculateWarmupSets } from "@/utils/warmup";
import { useAuthContext } from "@/context/AuthContext";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ExercisePicker } from "@/components/ExercisePicker";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getYearWeek(date: Date): string {
  const jan1 = new Date(date.getFullYear(), 0, 1);
  const dayOfYear =
    Math.floor((date.getTime() - jan1.getTime()) / 86_400_000) + 1;
  const weekNumber = Math.ceil(dayOfYear / 7);
  return `${date.getFullYear()}-${String(weekNumber).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WeekType = "normal" | "deload";

interface ExerciseEntry {
  prescriptionId: string | null;
  exerciseId: string;
  exerciseName: string;
  equipment: string | null;
  prescription: DbTemplateExercise | null;
  lastMaxWeight: number | null;
  warmupCount: number;
  workingSets: SetEntry[];
  substitutions: DbExerciseSubstitution[];
}

interface SetEntry {
  id: string;
  setType: "warmup" | "working";
  setNumber: number;
  weight: string;
  reps: string;
  rpe: string;
  saved: boolean;
}

// ---------------------------------------------------------------------------
// Setup Screen (pick template + week type)
// ---------------------------------------------------------------------------

interface SetupProps {
  onStart: (
    templateId: string | null,
    weekType: WeekType,
    templateName: string | null
  ) => void;
}

function WorkoutSetup({ onStart }: SetupProps) {
  const [templates, setTemplates] = useState<DbWorkoutTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("adhoc");
  const [weekType, setWeekType] = useState<WeekType>("normal");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void db.workoutTemplates.toArray().then((t) => {
      setTemplates(t);
      setIsLoading(false);
    });
  }, []);

  function handleStart() {
    const isAdhoc = selectedTemplateId === "adhoc";
    const template = templates.find((t) => t.id === selectedTemplateId);
    onStart(
      isAdhoc ? null : selectedTemplateId,
      weekType,
      template?.name ?? null
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Start Workout</h1>

      <Card>
        <CardHeader>
          <CardTitle>Template</CardTitle>
          <CardDescription>
            Pick a template or start an ad-hoc workout
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Select
            value={selectedTemplateId}
            onValueChange={setSelectedTemplateId}
          >
            <SelectTrigger className="min-h-[44px] w-full">
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="adhoc">Ad-hoc (no template)</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Week Type</p>
            <div className="flex gap-2">
              <Button
                variant={weekType === "normal" ? "default" : "outline"}
                className="flex-1 min-h-[44px]"
                onClick={() => setWeekType("normal")}
                type="button"
              >
                Normal
              </Button>
              <Button
                variant={weekType === "deload" ? "default" : "outline"}
                className="flex-1 min-h-[44px]"
                onClick={() => setWeekType("deload")}
                type="button"
              >
                Deload
              </Button>
            </div>
          </div>

          <Button
            className="min-h-[48px] text-base font-semibold"
            onClick={handleStart}
          >
            Start Workout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Set Row component (input-only, no per-set save button)
// ---------------------------------------------------------------------------

interface SetRowProps {
  entry: SetEntry;
  onChange: (field: "weight" | "reps" | "rpe", value: string) => void;
}

function SetRow({ entry, onChange }: SetRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-center text-xs text-muted-foreground shrink-0">
        {entry.setNumber}
      </span>
      <Input
        type="number"
        inputMode="decimal"
        placeholder="kg"
        value={entry.weight}
        onChange={(e) => onChange("weight", e.target.value)}
        className="min-h-[44px] flex-1"
      />
      <Input
        type="number"
        inputMode="numeric"
        placeholder="reps"
        value={entry.reps}
        onChange={(e) => onChange("reps", e.target.value)}
        className="min-h-[44px] flex-1"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exercise Card component
// ---------------------------------------------------------------------------

interface ExerciseCardProps {
  entry: ExerciseEntry;
  sessionId: string;
  onUpdateSets: (
    exerciseId: string,
    setType: "working",
    sets: SetEntry[]
  ) => void;
  onSubstitute: (
    exerciseId: string,
    newExerciseId: string,
    newExerciseName: string,
    newEquipment: string | null
  ) => void;
}

function ExerciseCard({
  entry,
  sessionId,
  onUpdateSets,
  onSubstitute,
}: ExerciseCardProps) {
  const [showSubstitutions, setShowSubstitutions] = useState(false);
  const [substitutes, setSubstitutes] = useState<DbExercise[]>([]);
  const [isLogged, setIsLogged] = useState(false);
  const rx = entry.prescription;

  const prescriptionText = rx
    ? `${rx.working_sets}x${rx.min_reps}-${rx.max_reps} @ RPE ${rx.early_set_rpe_min}-${rx.last_set_rpe_max}, Rest: ${rx.rest_period}`
    : null;

  const warmupGuidance = entry.warmupCount > 0
    ? calculateWarmupSets(entry.warmupCount, entry.lastMaxWeight)
    : null;

  // Check if already logged on mount (resuming a session)
  const allSaved = entry.workingSets.length > 0 && entry.workingSets.every((s) => s.saved);
  useEffect(() => {
    if (allSaved) setIsLogged(true);
  }, [allSaved]);

  useEffect(() => {
    if (!showSubstitutions) return;
    void (async () => {
      const subs = await db.exerciseSubstitutions
        .where("exercise_id")
        .equals(entry.exerciseId)
        .toArray();
      const subIds = subs.map((s) => s.substitute_exercise_id);
      if (subIds.length === 0) {
        setSubstitutes([]);
        return;
      }
      const exercises = await db.exercises
        .where("id")
        .anyOf(subIds)
        .toArray();
      setSubstitutes(exercises);
    })();
  }, [showSubstitutions, entry.exerciseId]);

  function handleSetChange(
    index: number,
    field: "weight" | "reps" | "rpe",
    value: string
  ) {
    const sets = [...entry.workingSets];
    sets[index] = { ...sets[index], [field]: value };
    onUpdateSets(entry.exerciseId, "working", sets);
  }

  async function handleLogExercise() {
    const updated = [...entry.workingSets];
    let savedAny = false;

    for (let i = 0; i < updated.length; i++) {
      const s = updated[i];
      if (s.saved) continue;

      const weight = parseFloat(s.weight);
      const reps = parseInt(s.reps, 10);
      const rpe = s.rpe ? parseFloat(s.rpe) : null;

      if (isNaN(weight) || weight <= 0) continue;
      if (isNaN(reps) || reps <= 0) continue;

      const record: DbWorkoutSet = {
        id: s.id,
        session_id: sessionId,
        exercise_id: entry.exerciseId,
        set_type: "working",
        set_number: s.setNumber,
        reps,
        weight,
        rpe,
        notes: null,
        created_at: new Date().toISOString(),
        sync_status: SYNC_STATUS.pending,
      };

      await db.workoutSets.put(record);
      updated[i] = { ...updated[i], saved: true };
      savedAny = true;
    }

    if (savedAny) {
      onUpdateSets(entry.exerciseId, "working", updated);
      setIsLogged(true);
    }
  }

  return (
    <>
      <Card className={isLogged ? "border-green-500/40 bg-green-500/5" : undefined}>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                {isLogged && <span className="text-green-600 mr-1">&#10003;</span>}
                {entry.exerciseName}
              </CardTitle>
              {entry.equipment && (
                <p className="text-xs text-muted-foreground">{entry.equipment}</p>
              )}
            </div>
            {entry.substitutions.length > 0 && !isLogged && (
              <Button
                variant="outline"
                size="sm"
                className="min-h-[36px] shrink-0"
                onClick={() => setShowSubstitutions(true)}
                type="button"
              >
                Swap
              </Button>
            )}
          </div>
          {prescriptionText && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {prescriptionText}
              </span>
              {rx?.intensity_technique && (
                <span className="inline-block rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
                  {rx.intensity_technique}
                </span>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* Warmup Guidance */}
          {entry.warmupCount > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">
                Warmup <span className="text-muted-foreground font-normal">({entry.warmupCount} sets)</span>
              </p>
              {warmupGuidance ? (
                <div className="flex flex-col gap-1">
                  {warmupGuidance.map((ws) => (
                    <div
                      key={ws.setNumber}
                      className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-1.5 text-xs"
                    >
                      <span className="w-4 text-center text-muted-foreground">{ws.setNumber}</span>
                      <span className="font-mono font-medium">{ws.weight} kg</span>
                      <span className="text-muted-foreground">&times; {ws.reps} reps</span>
                      <span className="ml-auto text-muted-foreground">{ws.percentage}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No previous data — warm up as needed
                </p>
              )}
            </div>
          )}

          {/* Working Sets */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              Working Sets
              {rx && (
                <span className="text-muted-foreground font-normal">
                  {" "}({rx.working_sets} sets, {rx.min_reps}-{rx.max_reps} reps)
                </span>
              )}
            </p>
            {entry.workingSets.map((s, i) => (
              <SetRow
                key={s.id}
                entry={s}
                onChange={(field, value) => handleSetChange(i, field, value)}
              />
            ))}
          </div>

          {/* Log Exercise button */}
          <Button
            variant={isLogged ? "secondary" : "default"}
            className="w-full min-h-[44px]"
            onClick={() => void handleLogExercise()}
            type="button"
          >
            {isLogged ? "Logged" : "Log Exercise"}
          </Button>
        </CardContent>
      </Card>

      {/* Substitution dialog */}
      <Dialog
        open={showSubstitutions}
        onOpenChange={(v) => !v && setShowSubstitutions(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Substitute Exercise</DialogTitle>
            <DialogDescription>
              Choose an alternative for {entry.exerciseName}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {substitutes.map((sub) => (
              <Button
                key={sub.id}
                variant="outline"
                className="min-h-[48px] justify-start text-left"
                onClick={() => {
                  onSubstitute(
                    entry.exerciseId,
                    sub.id,
                    sub.name,
                    sub.equipment
                  );
                  setShowSubstitutions(false);
                }}
                type="button"
              >
                <span>{sub.name}</span>
                {sub.equipment && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {sub.equipment}
                  </span>
                )}
              </Button>
            ))}
            {substitutes.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                No substitutions available
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Active Workout Screen
// ---------------------------------------------------------------------------

interface ActiveWorkoutProps {
  session: DbWorkoutSession;
  templateName: string | null;
  onFinished?: () => void;
}

function ActiveWorkout({ session, templateName, onFinished }: ActiveWorkoutProps) {
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

      const templateExercises = await db.templateExercises
        .where("template_id")
        .equals(session.template_id)
        .and((te) => te.week_type === session.week_type)
        .sortBy("order");

      const exerciseIds = templateExercises.map((te) => te.exercise_id);
      const exercisesData = await db.exercises
        .where("id")
        .anyOf(exerciseIds)
        .toArray();
      const exerciseMap = new Map(exercisesData.map((e) => [e.id, e]));

      const allSubs = await db.exerciseSubstitutions
        .where("exercise_id")
        .anyOf(exerciseIds)
        .toArray();
      const subsMap = new Map<string, DbExerciseSubstitution[]>();
      for (const s of allSubs) {
        const arr = subsMap.get(s.exercise_id) ?? [];
        arr.push(s);
        subsMap.set(s.exercise_id, arr);
      }

      // Look up last max weights for warmup guidance
      const allProgress = await db.exerciseProgress
        .where("exercise_id")
        .anyOf(exerciseIds)
        .toArray();
      const maxWeightMap = new Map<string, number>();
      for (const p of allProgress) {
        const current = maxWeightMap.get(p.exercise_id) ?? 0;
        if (p.max_weight > current) {
          maxWeightMap.set(p.exercise_id, p.max_weight);
        }
      }

      const entries: ExerciseEntry[] = templateExercises.map((te) => {
        const ex = exerciseMap.get(te.exercise_id);
        const subs = subsMap.get(te.exercise_id) ?? [];

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
          prescription: te,
          lastMaxWeight: maxWeightMap.get(te.exercise_id) ?? null,
          warmupCount: te.warmup_sets,
          workingSets,
          substitutions: subs,
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
      newExerciseId: string,
      newExerciseName: string,
      newEquipment: string | null
    ) => {
      setExercises((prev) =>
        prev.map((e) => {
          if (e.exerciseId !== oldExerciseId) return e;
          return {
            ...e,
            exerciseId: newExerciseId,
            exerciseName: newExerciseName,
            equipment: newEquipment,
            workingSets: e.workingSets.map((s) => ({ ...s, saved: false })),
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
        <div key={`${entry.exerciseId}-${entry.prescriptionId}`} className="flex flex-col gap-2">
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

// ---------------------------------------------------------------------------
// Today Screen (program-driven)
// ---------------------------------------------------------------------------

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

function TodayScreen({ program, onStartWorkout, onAdHoc }: TodayScreenProps) {
  const [routineInfos, setRoutineInfos] = useState<RoutineInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedExercises, setSelectedExercises] = useState<DbTemplateExercise[]>([]);
  const [exerciseMap, setExerciseMap] = useState<Map<string, DbExercise>>(new Map());
  const [progressMap, setProgressMap] = useState<Map<string, number>>(new Map());
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

        // Count exercises for this template in the current week type
        const texercises = template
          ? await db.templateExercises
              .where("template_id")
              .equals(template.id)
              .and((te) => te.week_type === weekType)
              .toArray()
          : [];

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

      const texercises = await db.templateExercises
        .where("template_id")
        .equals(info.template.id)
        .and((te) => te.week_type === weekType)
        .sortBy("order");

      if (cancelled) return;
      setSelectedExercises(texercises);

      const exerciseIds = texercises.map((te) => te.exercise_id);
      if (exerciseIds.length > 0) {
        const exercises = await db.exercises.where("id").anyOf(exerciseIds).toArray();
        if (!cancelled) setExerciseMap(new Map(exercises.map((e) => [e.id, e])));

        const allProgress = await db.exerciseProgress
          .where("exercise_id")
          .anyOf(exerciseIds)
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

// ---------------------------------------------------------------------------
// Main Workout Page
// ---------------------------------------------------------------------------

export default function Workout() {
  const { state: authState } = useAuthContext();
  const userId = authState.user?.id ?? "";

  const [session, setSession] = useState<DbWorkoutSession | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [activeProgram, setActiveProgram] = useState<DbProgram | null>(null);
  const [checkingActive, setCheckingActive] = useState(true);
  const [showAdHoc, setShowAdHoc] = useState(false);

  // Check for an active (unfinished) session and active program on mount
  useEffect(() => {
    void (async () => {
      try {
        if (!userId) {
          setCheckingActive(false);
          return;
        }

        // Check for unfinished session first
        const active = await db.workoutSessions
          .where("user_id")
          .equals(userId)
          .and((s) => s.finished_at === null)
          .first();

        if (active) {
          setSession(active);
          if (active.template_id) {
            const template = await db.workoutTemplates.get(active.template_id);
            setTemplateName(template?.name ?? null);
          }
          setCheckingActive(false);
          return;
        }

        // Check for active program — scan all and filter since Dexie
        // indexes booleans inconsistently across environments
        const allPrograms = await db.programs.toArray();
        const program = allPrograms.find((p) => p.is_active);

        if (program) {
          setActiveProgram(program);
        }
      } catch {
        // Dexie query failed — just show setup screen
      } finally {
        setCheckingActive(false);
      }
    })();
  }, [userId]);

  async function handleStart(
    templateId: string | null,
    weekType: WeekType,
    name: string | null,
    programId?: string,
  ) {
    const newSession: DbWorkoutSession = {
      id: uuidv4(),
      user_id: userId,
      template_id: templateId,
      year_week: getYearWeek(new Date()),
      week_type: weekType,
      started_at: new Date().toISOString(),
      finished_at: null,
      notes: null,
      program_id: programId ?? null,
      sync_status: SYNC_STATUS.pending,
    };

    await db.workoutSessions.put(newSession);
    setSession(newSession);
    setTemplateName(name);
  }

  function handleWorkoutFinished() {
    setSession(null);
    setTemplateName(null);
    setShowAdHoc(false);
    // Reload active program
    void (async () => {
      try {
        const allPrograms = await db.programs.toArray();
        const program = allPrograms.find((p) => p.is_active);
        setActiveProgram(program ?? null);
      } catch {
        setActiveProgram(null);
      }
    })();
  }

  if (checkingActive) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto max-w-md px-4 py-8">
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </main>
      </div>
    );
  }

  // State machine: 1) Active session, 2) Active program, 3) No program / Ad-hoc
  let content: React.ReactNode;

  if (session) {
    content = (
      <ActiveWorkout
        session={session}
        templateName={templateName}
        onFinished={handleWorkoutFinished}
      />
    );
  } else if (activeProgram && !showAdHoc) {
    content = (
      <TodayScreen
        program={activeProgram}
        onStartWorkout={(templateId, weekType, name, programId) =>
          void handleStart(templateId, weekType, name, programId)
        }
        onAdHoc={() => setShowAdHoc(true)}
      />
    );
  } else if (showAdHoc) {
    content = (
      <WorkoutSetup
        onStart={(tid, wt, name) => void handleStart(tid, wt, name)}
      />
    );
  } else {
    // No active program — prompt the user to create one
    content = (
      <div className="flex flex-col items-center gap-6 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">No Active Program</h1>
          <p className="text-muted-foreground">
            Create a program and activate it to see your daily routine here.
          </p>
        </div>
        <Button
          className="min-h-[48px] w-full max-w-xs text-base font-semibold"
          onClick={() => navigate("/programs")}
        >
          Go to Programs
        </Button>
        <button
          type="button"
          className="text-sm text-muted-foreground underline"
          onClick={() => setShowAdHoc(true)}
        >
          Start an ad-hoc workout instead
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <main className="mx-auto max-w-md px-4 py-8">{content}</main>
    </div>
  );
}
