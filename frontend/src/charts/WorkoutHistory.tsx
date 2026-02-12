import { useState, useEffect } from "react";
import { db } from "@/db/index";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, Hash } from "lucide-react";

interface HistoryEntry {
  id: string;
  startedAt: string;
  date: string;
  templateName: string;
  duration: string;
  setCount: number;
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "In progress";
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function WorkoutHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const sessions = await db.workoutSessions.toArray();
      const templates = await db.workoutTemplates.toArray();
      if (cancelled) return;

      const templateMap = new Map(templates.map((t) => [t.id, t]));

      const allSets = await db.workoutSets.toArray();
      const setCountMap = new Map<string, number>();
      for (const s of allSets) {
        setCountMap.set(s.session_id, (setCountMap.get(s.session_id) ?? 0) + 1);
      }

      const result: HistoryEntry[] = sessions.map((session) => ({
        id: session.id,
        startedAt: session.started_at,
        date: formatDate(session.started_at),
        templateName: session.template_id
          ? (templateMap.get(session.template_id)?.name ?? "Unknown")
          : "Ad-hoc",
        duration: formatDuration(session.started_at, session.finished_at),
        setCount: setCountMap.get(session.id) ?? 0,
      }));

      result.sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );

      if (!cancelled) setEntries(result);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No workouts logged yet
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <Card key={entry.id}>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{entry.templateName}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {entry.date}
              </div>
            </div>
            <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {entry.duration}
              </span>
              <span className="flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" /> {entry.setCount} sets
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
