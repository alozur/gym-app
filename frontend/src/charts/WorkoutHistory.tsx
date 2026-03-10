import { useState, useEffect, useMemo } from "react";
import { db } from "@/db/index";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Clock, Hash, Dumbbell } from "lucide-react";

interface WorkoutDay {
  id: string;
  name: string;
  startedAt: string;
  finishedAt: string | null;
  duration: string;
  setCount: number;
  volume: number;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "In progress";
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function WorkoutHistory() {
  const [workoutMap, setWorkoutMap] = useState<Map<string, WorkoutDay[]>>(new Map());
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);


  useEffect(() => {
    let cancelled = false;

    async function load() {
      const sessions = await db.workoutSessions.toArray();
      const finished = sessions.filter((s) => s.finished_at);
      if (cancelled || finished.length === 0) return;

      // Look up names: templates + phased workouts
      const templates = await db.workoutTemplates.toArray();
      const templateMap = new Map(templates.map((t) => [t.id, t.name]));
      const phaseWorkoutIds = [...new Set(finished.map((s) => s.phase_workout_id).filter(Boolean))] as string[];
      const phaseWorkouts = phaseWorkoutIds.length > 0
        ? await db.phaseWorkouts.where("id").anyOf(phaseWorkoutIds).toArray()
        : [];
      const phaseMap = new Map(phaseWorkouts.map((pw) => [pw.id, pw.name]));

      // Sets data
      const allSets = await db.workoutSets
        .where("set_type")
        .equals("working")
        .toArray();
      if (cancelled) return;

      const setCountMap = new Map<string, number>();
      const volumeMap = new Map<string, number>();
      for (const s of allSets) {
        setCountMap.set(s.session_id, (setCountMap.get(s.session_id) ?? 0) + 1);
        const vol = (s.weight || 1) * s.reps;
        volumeMap.set(s.session_id, (volumeMap.get(s.session_id) ?? 0) + vol);
      }

      const map = new Map<string, WorkoutDay[]>();
      for (const session of finished) {
        const d = new Date(session.started_at);
        const key = dateKey(d);

        let name = "Ad-hoc";
        if (session.template_id) {
          name = templateMap.get(session.template_id) ?? "Workout";
        } else if (session.phase_workout_id) {
          name = phaseMap.get(session.phase_workout_id) ?? "Workout";
        }

        const entry: WorkoutDay = {
          id: session.id,
          name,
          startedAt: session.started_at,
          finishedAt: session.finished_at,
          duration: formatDuration(session.started_at, session.finished_at),
          setCount: setCountMap.get(session.id) ?? 0,
          volume: Math.round(volumeMap.get(session.id) ?? 0),
        };

        const arr = map.get(key) ?? [];
        arr.push(entry);
        map.set(key, arr);
      }

      if (!cancelled) setWorkoutMap(map);
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  // Build calendar grid for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    // Monday = 0, Sunday = 6
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    // Pad to fill last row
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentMonth]);

  const monthLabel = currentMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const today = dateKey(new Date());

  const selectedWorkouts = selectedDate ? (workoutMap.get(selectedDate) ?? []) : [];

  return (
    <div className="flex flex-col gap-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
          className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[10px] font-medium text-muted-foreground py-1">
            {label}
          </div>
        ))}

        {/* Calendar cells */}
        {calendarDays.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} className="aspect-square" />;
          }
          const key = dateKey(day);
          const hasWorkout = workoutMap.has(key);
          const isToday = key === today;
          const isSelected = key === selectedDate;

          return (
            <button
              key={key}
              type="button"
              onClick={() => hasWorkout ? setSelectedDate(isSelected ? null : key) : undefined}
              className={`aspect-square flex flex-col items-center justify-center rounded-md text-xs transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : hasWorkout
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold hover:bg-emerald-500/25"
                    : isToday
                      ? "border border-primary/30 text-foreground"
                      : "text-muted-foreground"
              }`}
              disabled={!hasWorkout}
            >
              {day.getDate()}
              {hasWorkout && !isSelected && (
                <span className="h-1 w-1 rounded-full bg-emerald-500 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day details */}
      {selectedWorkouts.length > 0 && (
        <div className="flex flex-col gap-2">
          {selectedWorkouts.map((w) => (
            <Card key={w.id}>
              <CardContent className="py-3">
                <p className="text-sm font-medium">{w.name}</p>
                <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {w.duration}
                  </span>
                  <span className="flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5" /> {w.setCount} sets
                  </span>
                  <span className="flex items-center gap-1">
                    <Dumbbell className="h-3.5 w-3.5" /> {w.volume} kg
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {workoutMap.size === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No workouts logged yet
        </p>
      )}
    </div>
  );
}
