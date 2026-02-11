import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { db, type DbWorkoutTemplate } from "@/db/index";
import { useAuthContext } from "@/context/AuthContext";
import { api } from "@/api/client";
import type { TemplateResponse } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function Templates() {
  const navigate = useNavigate();
  const { state: authState } = useAuthContext();
  const [templates, setTemplates] = useState<DbWorkoutTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DbWorkoutTemplate | null>(null);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);

    // Load from Dexie first
    const local = await db.workoutTemplates.toArray();
    setTemplates(local);

    // If authenticated and online, fetch from API and update Dexie
    if (authState.isAuthenticated && navigator.onLine) {
      try {
        const remote = await api.get<TemplateResponse[]>("/templates");
        const mapped: DbWorkoutTemplate[] = remote.map((t) => ({
          id: t.id,
          user_id: authState.user?.id ?? "",
          name: t.name,
          created_at: t.created_at,
          sync_status: "synced" as const,
        }));

        await db.workoutTemplates.bulkPut(mapped);
        setTemplates(await db.workoutTemplates.toArray());
      } catch {
        // Use cached data
      }
    }

    setIsLoading(false);
  }, [authState.isAuthenticated, authState.user?.id]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  async function handleDelete() {
    if (!deleteTarget) return;

    // Delete template exercises from Dexie
    await db.templateExercises
      .where("template_id")
      .equals(deleteTarget.id)
      .delete();

    // Delete template from Dexie
    await db.workoutTemplates.delete(deleteTarget.id);

    // Try to delete from API if online
    if (navigator.onLine) {
      try {
        await api.delete(`/templates/${deleteTarget.id}`);
      } catch {
        // Will be handled on next sync
      }
    }

    setDeleteTarget(null);
    await loadTemplates();
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Templates</h1>
          <Button onClick={() => navigate("/templates/new")}>
            Create Template
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : templates.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No templates yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first workout template to get started
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle>{template.name}</CardTitle>
                  <CardDescription>
                    Created {formatDate(template.created_at)}
                  </CardDescription>
                  <CardAction>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/templates/${template.id}`)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(template)}
                      >
                        Delete
                      </Button>
                    </div>
                  </CardAction>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
