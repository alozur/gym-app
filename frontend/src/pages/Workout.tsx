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
} from "@/db/index";
import { useAuthContext } from "@/context/AuthContext";
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
  DialogFooter,
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
  warmupSets: SetEntry[];
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
// Set Row component
// ---------------------------------------------------------------------------

interface SetRowProps {
  entry: SetEntry;
  setType: "warmup" | "working";
  showRpe: boolean;
  targetRpe?: string;
  onChange: (field: "weight" | "reps" | "rpe", value: string) => void;
  onSave: () => void;
}

function SetRow({ entry, setType, showRpe, targetRpe, onChange, onSave }: SetRowProps) {
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
      {setType === "working" && (
        <>
          <Input
            type="number"
            inputMode="numeric"
            placeholder="reps"
            value={entry.reps}
            onChange={(e) => onChange("reps", e.target.value)}
            className="min-h-[44px] flex-1"
          />
          {showRpe && (
            <div className="flex flex-col items-center gap-0.5">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="RPE"
                min={1}
                max={10}
                step={0.5}
                value={entry.rpe}
                onChange={(e) => onChange("rpe", e.target.value)}
                className="min-h-[44px] w-16"
              />
              {targetRpe && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {targetRpe}
                </span>
              )}
            </div>
          )}
        </>
      )}
      <Button
        variant={entry.saved ? "secondary" : "default"}
        size="sm"
        className="min-h-[44px] min-w-[44px] shrink-0"
        onClick={onSave}
        type="button"
      >
        {entry.saved ? "OK" : "Log"}
      </Button>
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
    setType: "warmup" | "working",
    sets: SetEntry[]
  ) => void;
  onAddWarmupSet: (exerciseId: string) => void;
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
  onAddWarmupSet,
  onSubstitute,
}: ExerciseCardProps) {
  const [showSubstitutions, setShowSubstitutions] = useState(false);
  const [substitutes, setSubstitutes] = useState<DbExercise[]>([]);
  const [showIntensityPrompt, setShowIntensityPrompt] = useState(false);
  const rx = entry.prescription;

  const prescriptionText = rx
    ? `${rx.working_sets}x${rx.min_reps}-${rx.max_reps} @ RPE ${rx.early_set_rpe_min}-${rx.last_set_rpe_max}, Rest: ${rx.rest_period}`
    : null;

  const warmupRange = rx
    ? `${rx.min_warmup_sets}-${rx.max_warmup_sets} sets`
    : null;

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
    setType: "warmup" | "working",
    index: number,
    field: "weight" | "reps" | "rpe",
    value: string
  ) {
    const sets = setType === "warmup" ? [...entry.warmupSets] : [...entry.workingSets];
    sets[index] = { ...sets[index], [field]: value };
    onUpdateSets(entry.exerciseId, setType, sets);
  }

  async function handleSaveSet(setType: "warmup" | "working", index: number) {
    const sets = setType === "warmup" ? entry.warmupSets : entry.workingSets;
    const s = sets[index];
    const weight = parseFloat(s.weight);
    const reps = setType === "working" ? parseInt(s.reps, 10) : 0;
    const rpe = s.rpe ? parseFloat(s.rpe) : null;

    if (isNaN(weight) || weight <= 0) return;
    if (setType === "working" && (isNaN(reps) || reps <= 0)) return;

    const record: DbWorkoutSet = {
      id: s.id,
      session_id: sessionId,
      exercise_id: entry.exerciseId,
      set_type: setType,
      set_number: s.setNumber,
      reps: setType === "warmup" ? 0 : reps,
      weight,
      rpe,
      notes: null,
      created_at: new Date().toISOString(),
      sync_status: SYNC_STATUS.pending,
    };

    await db.workoutSets.put(record);

    const updated = [...sets];
    updated[index] = { ...updated[index], saved: true };
    onUpdateSets(entry.exerciseId, setType, updated);

    // Check if this was the last working set
    if (
      setType === "working" &&
      index === entry.workingSets.length - 1 &&
      rx?.intensity_technique
    ) {
      setShowIntensityPrompt(true);
    }
  }

  function getTargetRpe(setIndex: number): string | undefined {
    if (!rx) return undefined;
    const isLastSet = setIndex === entry.workingSets.length - 1;
    if (isLastSet) {
      return `${rx.last_set_rpe_min}-${rx.last_set_rpe_max}`;
    }
    return `${rx.early_set_rpe_min}-${rx.early_set_rpe_max}`;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">{entry.exerciseName}</CardTitle>
              {entry.equipment && (
                <p className="text-xs text-muted-foreground">{entry.equipment}</p>
              )}
            </div>
            {entry.substitutions.length > 0 && (
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
          {/* Warmup Sets */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Warmup{warmupRange && <span className="text-muted-foreground font-normal"> ({warmupRange})</span>}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddWarmupSet(entry.exerciseId)}
                type="button"
                className="min-h-[36px]"
              >
                + Add
              </Button>
            </div>
            {entry.warmupSets.map((s, i) => (
              <SetRow
                key={s.id}
                entry={s}
                setType="warmup"
                showRpe={false}
                onChange={(field, value) => handleSetChange("warmup", i, field, value)}
                onSave={() => void handleSaveSet("warmup", i)}
              />
            ))}
          </div>

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
                setType="working"
                showRpe
                targetRpe={getTargetRpe(i)}
                onChange={(field, value) => handleSetChange("working", i, field, value)}
                onSave={() => void handleSaveSet("working", i)}
              />
            ))}
          </div>
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

      {/* Intensity technique prompt */}
      <Dialog
        open={showIntensityPrompt}
        onOpenChange={(v) => !v && setShowIntensityPrompt(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Intensity Technique</DialogTitle>
            <DialogDescription>
              Perform: {rx?.intensity_technique}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowIntensityPrompt(false)}
              className="min-h-[44px]"
              type="button"
            >
              Skip
            </Button>
            <Button
              onClick={() => setShowIntensityPrompt(false)}
              className="min-h-[44px]"
              type="button"
            >
              Done
            </Button>
          </DialogFooter>
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
}

function ActiveWorkout({ session, templateName }: ActiveWorkoutProps) {
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
          warmupSets: [],
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
    (exerciseId: string, setType: "warmup" | "working", sets: SetEntry[]) => {
      setExercises((prev) =>
        prev.map((e) => {
          if (e.exerciseId !== exerciseId) return e;
          return setType === "warmup"
            ? { ...e, warmupSets: sets }
            : { ...e, workingSets: sets };
        })
      );
    },
    []
  );

  const handleAddWarmupSet = useCallback((exerciseId: string) => {
    setExercises((prev) =>
      prev.map((e) => {
        if (e.exerciseId !== exerciseId) return e;
        const newSet: SetEntry = {
          id: uuidv4(),
          setType: "warmup",
          setNumber: e.warmupSets.length + 1,
          weight: "",
          reps: "",
          rpe: "",
          saved: false,
        };
        return { ...e, warmupSets: [...e.warmupSets, newSet] };
      })
    );
  }, []);

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
            warmupSets: e.warmupSets.map((s) => ({ ...s, saved: false })),
            workingSets: e.workingSets.map((s) => ({ ...s, saved: false })),
          };
        })
      );
    },
    []
  );

  function handleAddExercise(ex: DbExercise) {
    const newEntry: ExerciseEntry = {
      prescriptionId: null,
      exerciseId: ex.id,
      exerciseName: ex.name,
      equipment: ex.equipment,
      prescription: null,
      warmupSets: [],
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

      const warmupSets = await db.workoutSets
        .where("session_id")
        .equals(session.id)
        .and(
          (s) =>
            s.exercise_id === entry.exerciseId && s.set_type === "warmup"
        )
        .toArray();

      if (workingSets.length === 0) continue;

      const maxWeight = Math.max(...workingSets.map((s) => s.weight));

      let warmupWeightRange: string | null = null;
      if (warmupSets.length > 0) {
        const warmupWeights = warmupSets.map((s) => s.weight);
        const minW = Math.min(...warmupWeights);
        const maxW = Math.max(...warmupWeights);
        warmupWeightRange = `${minW} - ${maxW}`;
      }

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
        warmup_weight_range: warmupWeightRange,
        warmup_sets_done: warmupSets.length,
        created_at: existing?.created_at ?? new Date().toISOString(),
        sync_status: SYNC_STATUS.pending,
      };

      await db.exerciseProgress.put(progressRecord);
    }

    setIsFinishing(false);
    navigate("/", { replace: true });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
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
            onAddWarmupSet={handleAddWarmupSet}
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

      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 safe-area-inset-bottom">
        <Button
          className="w-full min-h-[48px] text-base font-semibold"
          onClick={() => void handleFinishWorkout()}
          disabled={isFinishing}
          type="button"
        >
          {isFinishing ? "Finishing..." : "Finish Workout"}
        </Button>
      </div>

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
// Main Workout Page
// ---------------------------------------------------------------------------

export default function Workout() {
  const { state: authState } = useAuthContext();
  const userId = authState.user?.id ?? "";

  const [session, setSession] = useState<DbWorkoutSession | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [checkingActive, setCheckingActive] = useState(true);

  // Check for an active (unfinished) session on mount
  useEffect(() => {
    void (async () => {
      if (!userId) {
        setCheckingActive(false);
        return;
      }

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
      }
      setCheckingActive(false);
    })();
  }, [userId]);

  async function handleStart(
    templateId: string | null,
    weekType: WeekType,
    name: string | null
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
      sync_status: SYNC_STATUS.pending,
    };

    await db.workoutSessions.put(newSession);
    setSession(newSession);
    setTemplateName(name);
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-md px-4 py-8">
        {session ? (
          <ActiveWorkout session={session} templateName={templateName} />
        ) : (
          <WorkoutSetup onStart={(tid, wt, name) => void handleStart(tid, wt, name)} />
        )}
      </main>
    </div>
  );
}
