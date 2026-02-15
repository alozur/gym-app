import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import {
  db,
  type DbWorkoutTemplate,
  type DbProgramRoutine,
} from "@/db/index";
import { useAuthContext } from "@/context/AuthContext";
import { api } from "@/api/client";
import type { ProgramCreate } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";

interface RoutineEntry {
  localId: string;
  template_id: string;
  template_name: string;
}

export default function ProgramBuilder() {
  const navigate = useNavigate();
  const { id: programId } = useParams<{ id: string }>();
  const isEditMode = programId !== undefined;
  const { state: authState } = useAuthContext();

  const [name, setName] = useState("");
  const [deloadWeeks, setDeloadWeeks] = useState(6);
  const [routines, setRoutines] = useState<RoutineEntry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [templates, setTemplates] = useState<DbWorkoutTemplate[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(isEditMode);

  // Load templates for picker
  useEffect(() => {
    void db.workoutTemplates.toArray().then(setTemplates);
  }, []);

  // Load existing program in edit mode
  const loadProgram = useCallback(async () => {
    if (!programId) return;

    setIsLoading(true);

    const program = await db.programs.get(programId);
    if (!program) {
      setError("Program not found");
      setIsLoading(false);
      return;
    }

    setName(program.name);
    setDeloadWeeks(program.deload_every_n_weeks);

    const programRoutines = await db.programRoutines
      .where("program_id")
      .equals(programId)
      .toArray();

    programRoutines.sort((a, b) => a.order - b.order);

    const entries: RoutineEntry[] = [];
    for (const pr of programRoutines) {
      const template = await db.workoutTemplates.get(pr.template_id);
      entries.push({
        localId: uuidv4(),
        template_id: pr.template_id,
        template_name: template?.name ?? "Unknown Template",
      });
    }

    setRoutines(entries);
    setIsLoading(false);
  }, [programId]);

  useEffect(() => {
    if (isEditMode) {
      void loadProgram();
    }
  }, [isEditMode, loadProgram]);

  function handleAddRoutine(template: DbWorkoutTemplate) {
    setRoutines((prev) => [
      ...prev,
      {
        localId: uuidv4(),
        template_id: template.id,
        template_name: template.name,
      },
    ]);
    setPickerOpen(false);
  }

  function handleRemoveRoutine(localId: string) {
    setRoutines((prev) => prev.filter((r) => r.localId !== localId));
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    setRoutines((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function handleMoveDown(index: number) {
    setRoutines((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Program name is required");
      return;
    }

    if (routines.length === 0) {
      setError("Add at least one routine");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const userId = authState.user?.id ?? "";
      const progId = programId ?? uuidv4();
      const now = new Date().toISOString();

      // Build program routines for Dexie
      const dexieRoutines: DbProgramRoutine[] = routines.map((r, index) => ({
        id: uuidv4(),
        program_id: progId,
        template_id: r.template_id,
        order: index,
        sync_status: "pending" as const,
      }));

      // Write to Dexie FIRST (offline-first)
      if (isEditMode) {
        // Delete old routines
        await db.programRoutines
          .where("program_id")
          .equals(progId)
          .delete();

        await db.programs.put({
          id: progId,
          user_id: userId,
          name: name.trim(),
          deload_every_n_weeks: deloadWeeks,
          is_active: false,
          started_at: null,
          current_routine_index: 0,
          weeks_completed: 0,
          last_workout_at: null,
          created_at: now,
          sync_status: "pending",
        });
      } else {
        await db.programs.add({
          id: progId,
          user_id: userId,
          name: name.trim(),
          deload_every_n_weeks: deloadWeeks,
          is_active: false,
          started_at: null,
          current_routine_index: 0,
          weeks_completed: 0,
          last_workout_at: null,
          created_at: now,
          sync_status: "pending",
        });
      }

      await db.programRoutines.bulkAdd(dexieRoutines);

      // Try to sync to API if online
      if (navigator.onLine) {
        try {
          const payload: ProgramCreate = {
            id: progId,
            name: name.trim(),
            deload_every_n_weeks: deloadWeeks,
            routines: dexieRoutines.map((r, index) => ({
              id: r.id,
              template_id: r.template_id,
              order: index,
            })),
          };

          if (isEditMode) {
            await api.put(`/programs/${progId}`, payload);
          } else {
            await api.post("/programs", payload);
          }

          // Mark as synced
          await db.programs.update(progId, { sync_status: "synced" });
          await db.programRoutines
            .where("program_id")
            .equals(progId)
            .modify({ sync_status: "synced" });
        } catch {
          // Stays pending, will sync later
        }
      }

      navigate("/programs");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save program";
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
            {isEditMode ? "Edit Program" : "New Program"}
          </h1>
          <Button variant="outline" onClick={() => navigate("/programs")}>
            Cancel
          </Button>
        </div>

        {/* Program name */}
        <div className="mb-4">
          <Label htmlFor="program-name">Program Name</Label>
          <Input
            id="program-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Push Pull Legs"
          />
        </div>

        {/* Deload every N weeks */}
        <div className="mb-6">
          <Label htmlFor="deload-weeks">Deload Every N Weeks</Label>
          <Input
            id="deload-weeks"
            type="number"
            min={1}
            max={52}
            value={deloadWeeks}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1 && v <= 52) setDeloadWeeks(v);
            }}
          />
        </div>

        {/* Add routine button */}
        <Button
          className="mb-4 w-full"
          variant="outline"
          onClick={() => setPickerOpen(true)}
          type="button"
        >
          + Add Routine
        </Button>

        {/* Routine list */}
        <div className="flex flex-col gap-3">
          {routines.map((routine, index) => (
            <Card key={routine.localId}>
              <CardHeader>
                <CardTitle className="text-base">
                  {routine.template_name}
                </CardTitle>
                <CardAction>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => navigate(`/templates/${routine.template_id}`)}
                      aria-label="Edit routine"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
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
                      disabled={index === routines.length - 1}
                      onClick={() => handleMoveDown(index)}
                      aria-label="Move down"
                    >
                      &#9660;
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemoveRoutine(routine.localId)}
                      aria-label="Remove routine"
                    >
                      &#10005;
                    </Button>
                  </div>
                </CardAction>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Error */}
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {/* Save button */}
        <Button
          className="mt-6 w-full"
          disabled={isSaving}
          onClick={() => void handleSave()}
        >
          {isSaving
            ? "Saving..."
            : isEditMode
              ? "Update Program"
              : "Save Program"}
        </Button>
      </main>

      {/* Template picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Template</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {templates.map((template) => (
              <Button
                key={template.id}
                variant="outline"
                className="min-h-[48px] justify-start text-left"
                onClick={() => handleAddRoutine(template)}
                type="button"
              >
                {template.name}
              </Button>
            ))}
            {templates.length === 0 && (
              <p className="py-2 text-center text-sm text-muted-foreground">
                No templates yet.
              </p>
            )}
            <Button
              variant="secondary"
              className="min-h-[48px]"
              onClick={() => navigate("/templates/new")}
              type="button"
            >
              + Create New Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
