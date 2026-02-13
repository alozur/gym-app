import { useState } from "react";
import { db } from "@/db/index";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type ExportFormat = "csv" | "json";
type ExportScope = "all" | "4weeks" | "12weeks";

function getWeekCutoff(scope: ExportScope): string | null {
  if (scope === "all") return null;
  const weeks = scope === "4weeks" ? 4 : 12;
  const now = new Date();
  const cutoff = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export default function DataExport() {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [scope, setScope] = useState<ExportScope>("all");
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const cutoff = getWeekCutoff(scope);

      let sessions = await db.workoutSessions.toArray();
      if (cutoff) {
        sessions = sessions.filter((s) => s.started_at >= cutoff);
      }

      const sessionIds = new Set(sessions.map((s) => s.id));
      const allSets = await db.workoutSets.toArray();
      const sets = allSets.filter((s) => sessionIds.has(s.session_id));

      const exercises = await db.exercises.toArray();
      const exerciseMap = new Map(exercises.map((e) => [e.id, e.name]));

      const templates = await db.workoutTemplates.toArray();
      const templateMap = new Map(templates.map((t) => [t.id, t.name]));

      const sessionMap = new Map(sessions.map((s) => [s.id, s]));

      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === "csv") {
        const rows: string[] = [
          "date,template,week_type,exercise,set_type,set_number,weight,reps,rpe",
        ];

        for (const set of sets) {
          const session = sessionMap.get(set.session_id);
          if (!session) continue;
          const date = formatDate(session.started_at);
          const template = session.template_id
            ? (templateMap.get(session.template_id) ?? "")
            : "";
          const exerciseName = exerciseMap.get(set.exercise_id) ?? "";
          const rpe = set.rpe != null ? String(set.rpe) : "";

          rows.push(
            [
              date,
              csvEscape(template),
              session.week_type,
              csvEscape(exerciseName),
              set.set_type,
              set.set_number,
              set.weight,
              set.reps,
              rpe,
            ].join(","),
          );
        }

        downloadFile(
          rows.join("\n"),
          `gym-tracker-export-${dateStr}.csv`,
          "text/csv",
        );
      } else {
        const jsonSessions = sessions.map((session) => ({
          date: formatDate(session.started_at),
          template: session.template_id
            ? (templateMap.get(session.template_id) ?? null)
            : null,
          week_type: session.week_type,
          notes: session.notes,
          sets: sets
            .filter((s) => s.session_id === session.id)
            .map((s) => ({
              exercise: exerciseMap.get(s.exercise_id) ?? "",
              set_type: s.set_type,
              set_number: s.set_number,
              weight: s.weight,
              reps: s.reps,
              rpe: s.rpe,
            })),
        }));

        downloadFile(
          JSON.stringify(jsonSessions, null, 2),
          `gym-tracker-export-${dateStr}.json`,
          "application/json",
        );
      }

      setOpen(false);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Download className="mr-2 h-4 w-4" />
        Export Data
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Workout Data</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Format</legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="format"
                    value="csv"
                    checked={format === "csv"}
                    onChange={() => setFormat("csv")}
                    className="accent-primary"
                  />
                  CSV
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="format"
                    value="json"
                    checked={format === "json"}
                    onChange={() => setFormat("json")}
                    className="accent-primary"
                  />
                  JSON
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Scope</legend>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="scope"
                    value="all"
                    checked={scope === "all"}
                    onChange={() => setScope("all")}
                    className="accent-primary"
                  />
                  All Data
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="scope"
                    value="4weeks"
                    checked={scope === "4weeks"}
                    onChange={() => setScope("4weeks")}
                    className="accent-primary"
                  />
                  Last 4 Weeks
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="scope"
                    value="12weeks"
                    checked={scope === "12weeks"}
                    onChange={() => setScope("12weeks")}
                    className="accent-primary"
                  />
                  Last 12 Weeks
                </label>
              </div>
            </fieldset>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? "Exporting..." : "Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
