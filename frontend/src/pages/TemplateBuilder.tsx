import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { db, type DbExercise, type DbTemplateExercise } from "@/db/index";
import { useAuthContext } from "@/context/AuthContext";
import { api } from "@/api/client";
import type {
  TemplateCreate,
  TemplateExerciseCreate,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExercisePicker } from "@/components/ExercisePicker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PrescriptionFields {
  working_sets: number;
  min_reps: number;
  max_reps: number;
  early_set_rpe_min: number;
  early_set_rpe_max: number;
  last_set_rpe_min: number;
  last_set_rpe_max: number;
  rest_period: string;
  intensity_technique: string;
  warmup_sets: number;
}

interface SubstituteEntry {
  exercise: DbExercise;
  normal: PrescriptionFields;
  deload: PrescriptionFields;
}

interface ExerciseEntry {
  localId: string;
  exercise: DbExercise;
  normal: PrescriptionFields;
  deload: PrescriptionFields;
  substitutes: SubstituteEntry[];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function defaultPrescription(): PrescriptionFields {
  return {
    working_sets: 2,
    min_reps: 6,
    max_reps: 10,
    early_set_rpe_min: 7,
    early_set_rpe_max: 8,
    last_set_rpe_min: 9,
    last_set_rpe_max: 10,
    rest_period: "2-3 mins",
    intensity_technique: "",
    warmup_sets: 2,
  };
}

function defaultDeloadPrescription(): PrescriptionFields {
  return {
    working_sets: 2,
    min_reps: 6,
    max_reps: 10,
    early_set_rpe_min: 5,
    early_set_rpe_max: 6,
    last_set_rpe_min: 7,
    last_set_rpe_max: 8,
    rest_period: "2-3 mins",
    intensity_technique: "",
    warmup_sets: 2,
  };
}

// ---------------------------------------------------------------------------
// Prescription column component
// ---------------------------------------------------------------------------

interface PrescriptionColumnProps {
  label: string;
  fields: PrescriptionFields;
  onChange: (fields: PrescriptionFields) => void;
}

function PrescriptionColumn({ label, fields, onChange }: PrescriptionColumnProps) {
  function update<K extends keyof PrescriptionFields>(
    key: K,
    value: PrescriptionFields[K],
  ) {
    onChange({ ...fields, [key]: value });
  }

  function numVal(e: React.ChangeEvent<HTMLInputElement>): number {
    const v = parseFloat(e.target.value);
    return Number.isNaN(v) ? 0 : v;
  }

  return (
    <div className="flex flex-1 flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <div>
        <Label className="text-xs">Working Sets</Label>
        <Input
          type="number"
          min={1}
          max={10}
          value={fields.working_sets}
          onChange={(e) => update("working_sets", numVal(e))}
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Min Reps</Label>
          <Input
            type="number"
            min={1}
            value={fields.min_reps}
            onChange={(e) => update("min_reps", numVal(e))}
          />
        </div>
        <div className="flex-1">
          <Label className="text-xs">Max Reps</Label>
          <Input
            type="number"
            min={1}
            value={fields.max_reps}
            onChange={(e) => update("max_reps", numVal(e))}
          />
        </div>
      </div>

      {/* RPE Prescription */}
      <div className="rounded-md border border-border p-2 flex flex-col gap-2">
        <p className="text-[11px] font-semibold text-muted-foreground">RPE Prescription</p>

        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-xs">Early Sets Min</Label>
            <Input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={fields.early_set_rpe_min}
              onChange={(e) => update("early_set_rpe_min", numVal(e))}
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Early Sets Max</Label>
            <Input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={fields.early_set_rpe_max}
              onChange={(e) => update("early_set_rpe_max", numVal(e))}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-xs">Last Set Min</Label>
            <Input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={fields.last_set_rpe_min}
              onChange={(e) => update("last_set_rpe_min", numVal(e))}
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Last Set Max</Label>
            <Input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={fields.last_set_rpe_max}
              onChange={(e) => update("last_set_rpe_max", numVal(e))}
            />
          </div>
        </div>
      </div>

      <div>
        <Label className="text-xs">Rest Period</Label>
        <Input
          value={fields.rest_period}
          placeholder="e.g. 1-2 mins"
          onChange={(e) => update("rest_period", e.target.value)}
        />
      </div>

      <div>
        <Label className="text-xs">Intensity Technique</Label>
        <Input
          value={fields.intensity_technique}
          placeholder="e.g. Failure, LLPs"
          onChange={(e) => update("intensity_technique", e.target.value)}
        />
      </div>

      <div>
        <Label className="text-xs">Warmup Sets</Label>
        <Input
          type="number"
          min={0}
          max={4}
          value={fields.warmup_sets}
          onChange={(e) => update("warmup_sets", numVal(e))}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TemplateBuilder page
// ---------------------------------------------------------------------------

export default function TemplateBuilder() {
  const navigate = useNavigate();
  const { id: templateId } = useParams<{ id: string }>();
  const isEditMode = templateId !== undefined;
  const { state: authState } = useAuthContext();

  const [name, setName] = useState("");
  const [entries, setEntries] = useState<ExerciseEntry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const [subPickerForEntry, setSubPickerForEntry] = useState<string | null>(null);

  // All exercise IDs used anywhere in this template (main + substitutes)
  const allUsedExerciseIds = useMemo(() => {
    const ids: string[] = [];
    for (const e of entries) {
      ids.push(e.exercise.id);
      for (const s of e.substitutes) {
        ids.push(s.exercise.id);
      }
    }
    return ids;
  }, [entries]);

  // -----------------------------------------------------------------------
  // Load existing template in edit mode
  // -----------------------------------------------------------------------
  const loadTemplate = useCallback(async () => {
    if (!templateId) return;

    setIsLoading(true);

    const template = await db.workoutTemplates.get(templateId);
    if (!template) {
      setError("Template not found");
      setIsLoading(false);
      return;
    }

    setName(template.name);

    const allTEs = await db.templateExercises
      .where("template_id")
      .equals(templateId)
      .toArray();

    function toPrescription(te: DbTemplateExercise | undefined): PrescriptionFields {
      if (!te) return defaultPrescription();
      return {
        working_sets: te.working_sets,
        min_reps: te.min_reps,
        max_reps: te.max_reps,
        early_set_rpe_min: te.early_set_rpe_min,
        early_set_rpe_max: te.early_set_rpe_max,
        last_set_rpe_min: te.last_set_rpe_min,
        last_set_rpe_max: te.last_set_rpe_max,
        rest_period: te.rest_period,
        intensity_technique: te.intensity_technique ?? "",
        warmup_sets: te.warmup_sets,
      };
    }

    // Separate main exercises (no parent) from substitute TEs
    const mainTEs = allTEs.filter((te) => !te.parent_exercise_id);
    const subTEs = allTEs.filter((te) => !!te.parent_exercise_id);

    // Group main TEs by exercise_id
    const grouped = new Map<string, { normal?: DbTemplateExercise; deload?: DbTemplateExercise }>();
    for (const te of mainTEs) {
      const key = te.exercise_id;
      const existing = grouped.get(key) ?? {};
      if (te.week_type === "normal") existing.normal = te;
      else existing.deload = te;
      grouped.set(key, existing);
    }

    // Group substitute TEs by parent_exercise_id
    const subsByParent = new Map<string, DbTemplateExercise[]>();
    for (const te of subTEs) {
      const arr = subsByParent.get(te.parent_exercise_id!) ?? [];
      arr.push(te);
      subsByParent.set(te.parent_exercise_id!, arr);
    }

    // Build entries
    const loadedEntries: ExerciseEntry[] = [];
    for (const [exerciseId, pair] of grouped) {
      const exercise = await db.exercises.get(exerciseId);
      if (!exercise) continue;

      const mainNormalId = pair.normal?.id;

      // Build substitute entries from new-format TEs
      const childTEs = mainNormalId ? (subsByParent.get(mainNormalId) ?? []) : [];
      let substitutes: SubstituteEntry[] = [];

      if (childTEs.length > 0) {
        // New format: group child TEs by exercise_id
        const childGrouped = new Map<string, { normal?: DbTemplateExercise; deload?: DbTemplateExercise }>();
        for (const te of childTEs) {
          const existing = childGrouped.get(te.exercise_id) ?? {};
          if (te.week_type === "normal") existing.normal = te;
          else existing.deload = te;
          childGrouped.set(te.exercise_id, existing);
        }

        for (const [subExId, subPair] of childGrouped) {
          const subEx = await db.exercises.get(subExId);
          if (!subEx) continue;
          substitutes.push({
            exercise: subEx,
            normal: toPrescription(subPair.normal),
            deload: toPrescription(subPair.deload),
          });
        }
      } else {
        // Fallback: load from old exerciseSubstitutions table
        const subRecords = await db.exerciseSubstitutions
          .where("exercise_id")
          .equals(exerciseId)
          .toArray();
        const subIds = subRecords.map((s) => s.substitute_exercise_id);
        const subExercises = subIds.length > 0
          ? await db.exercises.where("id").anyOf(subIds).toArray()
          : [];

        substitutes = subExercises.map((subEx) => ({
          exercise: subEx,
          normal: defaultPrescription(),
          deload: defaultDeloadPrescription(),
        }));
      }

      loadedEntries.push({
        localId: uuidv4(),
        exercise,
        normal: toPrescription(pair.normal),
        deload: toPrescription(pair.deload),
        substitutes,
      });
    }

    // Sort by order
    loadedEntries.sort((a, b) => {
      const aOrder = grouped.get(a.exercise.id)?.normal?.order ?? 0;
      const bOrder = grouped.get(b.exercise.id)?.normal?.order ?? 0;
      return aOrder - bOrder;
    });

    setEntries(loadedEntries);
    setIsLoading(false);
  }, [templateId]);

  useEffect(() => {
    if (isEditMode) {
      void loadTemplate();
    }
  }, [isEditMode, loadTemplate]);

  // -----------------------------------------------------------------------
  // Exercise management
  // -----------------------------------------------------------------------
  function handleAddExercise(exercise: DbExercise) {
    setEntries((prev) => [
      ...prev,
      {
        localId: uuidv4(),
        exercise,
        normal: defaultPrescription(),
        deload: defaultDeloadPrescription(),
        substitutes: [],
      },
    ]);
    setPickerOpen(false);
  }

  function handleRemoveExercise(localId: string) {
    setEntries((prev) => prev.filter((e) => e.localId !== localId));
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    setEntries((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function handleMoveDown(index: number) {
    setEntries((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  function updateNormal(localId: string, fields: PrescriptionFields) {
    setEntries((prev) =>
      prev.map((e) => (e.localId === localId ? { ...e, normal: fields } : e)),
    );
  }

  function updateDeload(localId: string, fields: PrescriptionFields) {
    setEntries((prev) =>
      prev.map((e) => (e.localId === localId ? { ...e, deload: fields } : e)),
    );
  }

  function updateExerciseField(localId: string, field: "youtube_url" | "notes", value: string) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.localId !== localId) return e;
        const updated = { ...e, exercise: { ...e.exercise, [field]: value || null } };
        // Persist to Dexie immediately
        void db.exercises.update(e.exercise.id, { [field]: value || null, sync_status: "pending" });
        return updated;
      }),
    );
  }

  // -----------------------------------------------------------------------
  // Substitute management
  // -----------------------------------------------------------------------

  function handleAddSubstitute(subExercise: DbExercise) {
    const entryLocalId = subPickerForEntry;
    if (!entryLocalId) return;

    const newSub: SubstituteEntry = {
      exercise: subExercise,
      normal: defaultPrescription(),
      deload: defaultDeloadPrescription(),
    };

    setEntries((prev) =>
      prev.map((e) => {
        if (e.localId !== entryLocalId) return e;
        return { ...e, substitutes: [...e.substitutes, newSub] };
      }),
    );
    setSubPickerForEntry(null);
  }

  function handleRemoveSubstitute(localId: string, subExerciseId: string) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.localId !== localId) return e;
        return { ...e, substitutes: e.substitutes.filter((s) => s.exercise.id !== subExerciseId) };
      }),
    );
  }

  function updateSubNormal(localId: string, subExerciseId: string, fields: PrescriptionFields) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.localId !== localId) return e;
        return {
          ...e,
          substitutes: e.substitutes.map((s) =>
            s.exercise.id === subExerciseId ? { ...s, normal: fields } : s,
          ),
        };
      }),
    );
  }

  function updateSubDeload(localId: string, subExerciseId: string, fields: PrescriptionFields) {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.localId !== localId) return e;
        return {
          ...e,
          substitutes: e.substitutes.map((s) =>
            s.exercise.id === subExerciseId ? { ...s, deload: fields } : s,
          ),
        };
      }),
    );
  }

  // -----------------------------------------------------------------------
  // Save
  // -----------------------------------------------------------------------
  async function handleSave() {
    if (!name.trim()) {
      setError("Template name is required");
      return;
    }

    if (entries.length === 0) {
      setError("Add at least one exercise");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const userId = authState.user?.id ?? "";
      const tplId = templateId ?? uuidv4();
      const now = new Date().toISOString();

      // Build template_exercises for Dexie
      const dexieTemplateExercises: DbTemplateExercise[] = [];
      const apiTemplateExercises: TemplateExerciseCreate[] = [];

      entries.forEach((entry, index) => {
        // Normal week
        const normalId = uuidv4();
        const normalFields = {
          id: normalId,
          exercise_id: entry.exercise.id,
          week_type: "normal" as const,
          order: index,
          working_sets: entry.normal.working_sets,
          min_reps: entry.normal.min_reps,
          max_reps: entry.normal.max_reps,
          early_set_rpe_min: entry.normal.early_set_rpe_min,
          early_set_rpe_max: entry.normal.early_set_rpe_max,
          last_set_rpe_min: entry.normal.last_set_rpe_min,
          last_set_rpe_max: entry.normal.last_set_rpe_max,
          rest_period: entry.normal.rest_period,
          intensity_technique: entry.normal.intensity_technique || null,
          warmup_sets: entry.normal.warmup_sets,
        };

        dexieTemplateExercises.push({
          template_id: tplId,
          parent_exercise_id: null,
          sync_status: "pending",
          ...normalFields,
        });

        apiTemplateExercises.push(normalFields);

        // Deload week
        const deloadId = uuidv4();
        const deloadFields = {
          id: deloadId,
          exercise_id: entry.exercise.id,
          week_type: "deload" as const,
          order: index,
          working_sets: entry.deload.working_sets,
          min_reps: entry.deload.min_reps,
          max_reps: entry.deload.max_reps,
          early_set_rpe_min: entry.deload.early_set_rpe_min,
          early_set_rpe_max: entry.deload.early_set_rpe_max,
          last_set_rpe_min: entry.deload.last_set_rpe_min,
          last_set_rpe_max: entry.deload.last_set_rpe_max,
          rest_period: entry.deload.rest_period,
          intensity_technique: entry.deload.intensity_technique || null,
          warmup_sets: entry.deload.warmup_sets,
        };

        dexieTemplateExercises.push({
          template_id: tplId,
          parent_exercise_id: null,
          sync_status: "pending",
          ...deloadFields,
        });

        apiTemplateExercises.push(deloadFields);

        // Substitute TEs — saved with parent_exercise_id pointing to main's normal TE
        for (const sub of entry.substitutes) {
          const subNormalId = uuidv4();
          dexieTemplateExercises.push({
            id: subNormalId,
            template_id: tplId,
            exercise_id: sub.exercise.id,
            week_type: "normal",
            order: index,
            working_sets: sub.normal.working_sets,
            min_reps: sub.normal.min_reps,
            max_reps: sub.normal.max_reps,
            early_set_rpe_min: sub.normal.early_set_rpe_min,
            early_set_rpe_max: sub.normal.early_set_rpe_max,
            last_set_rpe_min: sub.normal.last_set_rpe_min,
            last_set_rpe_max: sub.normal.last_set_rpe_max,
            rest_period: sub.normal.rest_period,
            intensity_technique: sub.normal.intensity_technique || null,
            warmup_sets: sub.normal.warmup_sets,
            parent_exercise_id: normalId,
            sync_status: "pending",
          });

          dexieTemplateExercises.push({
            id: uuidv4(),
            template_id: tplId,
            exercise_id: sub.exercise.id,
            week_type: "deload",
            order: index,
            working_sets: sub.deload.working_sets,
            min_reps: sub.deload.min_reps,
            max_reps: sub.deload.max_reps,
            early_set_rpe_min: sub.deload.early_set_rpe_min,
            early_set_rpe_max: sub.deload.early_set_rpe_max,
            last_set_rpe_min: sub.deload.last_set_rpe_min,
            last_set_rpe_max: sub.deload.last_set_rpe_max,
            rest_period: sub.deload.rest_period,
            intensity_technique: sub.deload.intensity_technique || null,
            warmup_sets: sub.deload.warmup_sets,
            parent_exercise_id: normalId,
            sync_status: "pending",
          });
        }
      });

      // Write to Dexie FIRST (offline-first)
      if (isEditMode) {
        // Delete old template exercises
        await db.templateExercises
          .where("template_id")
          .equals(tplId)
          .delete();

        // Update template
        await db.workoutTemplates.put({
          id: tplId,
          user_id: userId,
          name: name.trim(),
          created_at: now,
          sync_status: "pending",
        });
      } else {
        await db.workoutTemplates.add({
          id: tplId,
          user_id: userId,
          name: name.trim(),
          created_at: now,
          sync_status: "pending",
        });
      }

      await db.templateExercises.bulkAdd(dexieTemplateExercises);

      // Try to sync to API if online
      if (navigator.onLine) {
        try {
          const payload: TemplateCreate = {
            id: tplId,
            name: name.trim(),
            template_exercises: apiTemplateExercises,
          };

          if (isEditMode) {
            await api.put(`/templates/${tplId}`, payload);
          } else {
            await api.post("/templates", payload);
          }

          // Mark as synced
          await db.workoutTemplates.update(tplId, { sync_status: "synced" });
          await db.templateExercises
            .where("template_id")
            .equals(tplId)
            .modify({ sync_status: "synced" });
        } catch {
          // Stays pending, will sync later
        }
      }

      navigate("/programs");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save template";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {isEditMode ? "Edit Template" : "New Template"}
          </h1>
          <Button variant="outline" onClick={() => navigate("/programs")}>
            Cancel
          </Button>
        </div>

        {/* Template name */}
        <div className="mb-6">
          <Label htmlFor="template-name">Template Name</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Push Day, Leg Day"
          />
        </div>

        {/* Add exercise button */}
        <Button
          className="mb-4 w-full"
          variant="outline"
          onClick={() => setPickerOpen(true)}
          type="button"
        >
          + Add Exercise
        </Button>

        {/* Exercise list */}
        <div className="flex flex-col gap-4">
          {entries.map((entry, index) => (
            <Card key={entry.localId}>
              <CardHeader>
                <CardTitle className="text-base">{entry.exercise.name}</CardTitle>
                <CardDescription>{entry.exercise.muscle_group}</CardDescription>
                <CardAction>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={index === 0}
                      onClick={() => handleMoveUp(index)}
                      aria-label="Move up"
                    >
                      &#9650;
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={index === entries.length - 1}
                      onClick={() => handleMoveDown(index)}
                      aria-label="Move down"
                    >
                      &#9660;
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemoveExercise(entry.localId)}
                      aria-label="Remove exercise"
                    >
                      &#10005;
                    </Button>
                  </div>
                </CardAction>
              </CardHeader>

              <CardContent>
                {/* Exercise details */}
                <div className="flex flex-col gap-2 mb-4">
                  <div>
                    <Label className="text-xs">YouTube URL</Label>
                    <Input
                      value={entry.exercise.youtube_url ?? ""}
                      placeholder="https://youtube.com/watch?v=..."
                      onChange={(e) => updateExerciseField(entry.localId, "youtube_url", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <textarea
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[60px] resize-y"
                      value={entry.exercise.notes ?? ""}
                      placeholder="Form cues, tips, etc."
                      onChange={(e) => updateExerciseField(entry.localId, "notes", e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>

                {/* Substitutes */}
                <div className="flex flex-col gap-3 mb-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Substitutes ({entry.substitutes.length}/2)
                    </p>
                    {entry.substitutes.length < 2 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSubPickerForEntry(entry.localId)}
                        type="button"
                      >
                        + Add Substitute
                      </Button>
                    )}
                  </div>
                  {entry.substitutes.map((sub) => (
                    <div key={sub.exercise.id} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                            SUB
                          </span>
                          <p className="text-sm font-medium truncate">{sub.exercise.name}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="shrink-0"
                          onClick={() => handleRemoveSubstitute(entry.localId, sub.exercise.id)}
                          aria-label={`Remove ${sub.exercise.name}`}
                        >
                          &#10005;
                        </Button>
                      </div>
                      {sub.exercise.equipment && (
                        <p className="text-[11px] text-muted-foreground -mt-2">{sub.exercise.equipment}</p>
                      )}
                      <div className="flex gap-4">
                        <PrescriptionColumn
                          label="Normal Week"
                          fields={sub.normal}
                          onChange={(f) => updateSubNormal(entry.localId, sub.exercise.id, f)}
                        />
                        <PrescriptionColumn
                          label="Deload Week"
                          fields={sub.deload}
                          onChange={(f) => updateSubDeload(entry.localId, sub.exercise.id, f)}
                        />
                      </div>
                    </div>
                  ))}
                  {entry.substitutes.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">
                      No substitutes — swipe will be disabled during workout
                    </p>
                  )}
                </div>

                <div className="flex gap-4">
                  <PrescriptionColumn
                    label="Normal Week"
                    fields={entry.normal}
                    onChange={(f) => updateNormal(entry.localId, f)}
                  />
                  <PrescriptionColumn
                    label="Deload Week"
                    fields={entry.deload}
                    onChange={(f) => updateDeload(entry.localId, f)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}

        {/* Save button */}
        <Button
          className="mt-6 w-full"
          disabled={isSaving}
          onClick={() => void handleSave()}
        >
          {isSaving
            ? "Saving..."
            : isEditMode
              ? "Update Template"
              : "Save Template"}
        </Button>
      </main>

      {/* Exercise picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Exercise</DialogTitle>
          </DialogHeader>
          <ExercisePicker
            onSelect={handleAddExercise}
            excludeIds={allUsedExerciseIds}
          />
        </DialogContent>
      </Dialog>

      {/* Substitute picker dialog */}
      <Dialog
        open={subPickerForEntry !== null}
        onOpenChange={(v) => !v && setSubPickerForEntry(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Substitute</DialogTitle>
          </DialogHeader>
          <ExercisePicker
            onSelect={handleAddSubstitute}
            excludeIds={allUsedExerciseIds}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
