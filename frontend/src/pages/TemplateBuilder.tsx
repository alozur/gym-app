import { useState, useEffect, useCallback } from "react";
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
  min_warmup_sets: number;
  max_warmup_sets: number;
}

interface ExerciseEntry {
  localId: string;
  exercise: DbExercise;
  normal: PrescriptionFields;
  deload: PrescriptionFields;
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
    min_warmup_sets: 1,
    max_warmup_sets: 2,
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
    min_warmup_sets: 1,
    max_warmup_sets: 2,
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

      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Early RPE Min</Label>
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
          <Label className="text-xs">Early RPE Max</Label>
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
          <Label className="text-xs">Last RPE Min</Label>
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
          <Label className="text-xs">Last RPE Max</Label>
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

      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Min Warmup</Label>
          <Input
            type="number"
            min={0}
            value={fields.min_warmup_sets}
            onChange={(e) => update("min_warmup_sets", numVal(e))}
          />
        </div>
        <div className="flex-1">
          <Label className="text-xs">Max Warmup</Label>
          <Input
            type="number"
            min={0}
            value={fields.max_warmup_sets}
            onChange={(e) => update("max_warmup_sets", numVal(e))}
          />
        </div>
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

    const templateExercises = await db.templateExercises
      .where("template_id")
      .equals(templateId)
      .toArray();

    // Group by exercise_id and order
    const grouped = new Map<string, { normal?: DbTemplateExercise; deload?: DbTemplateExercise }>();
    for (const te of templateExercises) {
      const key = te.exercise_id;
      const existing = grouped.get(key) ?? {};
      if (te.week_type === "normal") {
        existing.normal = te;
      } else {
        existing.deload = te;
      }
      grouped.set(key, existing);
    }

    // Build entries
    const loadedEntries: ExerciseEntry[] = [];
    for (const [exerciseId, pair] of grouped) {
      const exercise = await db.exercises.get(exerciseId);
      if (!exercise) continue;

      const order = pair.normal?.order ?? pair.deload?.order ?? loadedEntries.length;

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
          min_warmup_sets: te.min_warmup_sets,
          max_warmup_sets: te.max_warmup_sets,
        };
      }

      loadedEntries.push({
        localId: uuidv4(),
        exercise,
        normal: toPrescription(pair.normal),
        deload: toPrescription(pair.deload),
      });

      // Sort by order
      loadedEntries.sort((a, b) => {
        const aOrder = grouped.get(a.exercise.id)?.normal?.order ?? 0;
        const bOrder = grouped.get(b.exercise.id)?.normal?.order ?? 0;
        return aOrder - bOrder;
      });

      void order; // Used in sort above via closure
    }

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
          min_warmup_sets: entry.normal.min_warmup_sets,
          max_warmup_sets: entry.normal.max_warmup_sets,
        };

        dexieTemplateExercises.push({
          id: normalId,
          template_id: tplId,
          sync_status: "pending",
          ...normalFields,
        });

        apiTemplateExercises.push(normalFields);

        // Deload week
        const deloadId = uuidv4();
        const deloadFields = {
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
          min_warmup_sets: entry.deload.min_warmup_sets,
          max_warmup_sets: entry.deload.max_warmup_sets,
        };

        dexieTemplateExercises.push({
          id: deloadId,
          template_id: tplId,
          sync_status: "pending",
          ...deloadFields,
        });

        apiTemplateExercises.push(deloadFields);
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

      navigate("/templates");
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
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {isEditMode ? "Edit Template" : "New Template"}
          </h1>
          <Button variant="outline" onClick={() => navigate("/templates")}>
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
            excludeIds={entries.map((e) => e.exercise.id)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
