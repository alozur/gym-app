import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  db,
  type DbExercise,
  type DbExerciseProgress,
  type DbWorkoutSet,
} from "@/db/index";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WeekRow {
  yearWeek: string;
  workingSets: DbWorkoutSet[];
  maxWeight: number | null;
  warmupRange: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExerciseLog() {
  const { id } = useParams<{ id: string }>();
  const [exercise, setExercise] = useState<DbExercise | null>(null);
  const [progress, setProgress] = useState<DbExerciseProgress[]>([]);
  const [sets, setSets] = useState<DbWorkoutSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      const [ex, prog, allSets] = await Promise.all([
        db.exercises.get(id!),
        db.exerciseProgress
          .where("exercise_id")
          .equals(id!)
          .toArray(),
        db.workoutSets
          .where("exercise_id")
          .equals(id!)
          .toArray(),
      ]);

      if (cancelled) return;

      setExercise(ex ?? null);
      setProgress(prog);
      setSets(allSets);
      setIsLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Build a map of session_id -> year_week for grouping sets
  const [sessionYearWeeks, setSessionYearWeeks] = useState<Map<string, string>>(
    new Map()
  );

  useEffect(() => {
    if (sets.length === 0) return;
    const sessionIds = [...new Set(sets.map((s) => s.session_id))];
    void (async () => {
      const sessions = await db.workoutSessions
        .where("id")
        .anyOf(sessionIds)
        .toArray();
      const map = new Map<string, string>();
      for (const s of sessions) {
        if (s.year_week) {
          map.set(s.id, s.year_week);
        }
      }
      setSessionYearWeeks(map);
    })();
  }, [sets]);

  // Build progress-based map
  const progressMap = useMemo(() => {
    const map = new Map<string, DbExerciseProgress>();
    for (const p of progress) {
      map.set(p.year_week, p);
    }
    return map;
  }, [progress]);

  // Group sets by year_week and build rows
  const rows: WeekRow[] = useMemo(() => {
    const yearWeekSetsMap = new Map<string, DbWorkoutSet[]>();

    for (const s of sets) {
      if (s.set_type !== "working") continue;
      const yw = sessionYearWeeks.get(s.session_id);
      if (!yw) continue;
      const arr = yearWeekSetsMap.get(yw) ?? [];
      arr.push(s);
      yearWeekSetsMap.set(yw, arr);
    }

    // Collect all year_weeks from both sources
    const allYearWeeks = new Set<string>([
      ...yearWeekSetsMap.keys(),
      ...progressMap.keys(),
    ]);

    const result: WeekRow[] = [];
    for (const yw of allYearWeeks) {
      const workingSets = (yearWeekSetsMap.get(yw) ?? []).sort(
        (a, b) => a.set_number - b.set_number
      );
      const prog = progressMap.get(yw);

      result.push({
        yearWeek: yw,
        workingSets,
        maxWeight: prog?.max_weight ?? null,
        warmupRange: prog?.warmup_weight_range ?? null,
      });
    }

    // Sort descending by year_week (most recent first)
    result.sort((a, b) => b.yearWeek.localeCompare(a.yearWeek));
    return result;
  }, [sets, sessionYearWeeks, progressMap]);

  // Determine maximum set count for column headers
  const maxSetCount = useMemo(
    () => Math.max(4, ...rows.map((r) => r.workingSets.length)),
    [rows]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-20">
        <main className="mx-auto max-w-md px-4 py-8">
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </main>
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-20">
        <main className="mx-auto max-w-md px-4 py-8">
          <p className="text-center text-muted-foreground">
            Exercise not found
          </p>
          <Button variant="link" asChild className="mt-4 w-full">
            <Link to="/exercises">Back to Exercises</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <main className="mx-auto max-w-lg px-4 py-8">
        <div className="flex flex-col gap-4">
          <div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/exercises">Back</Link>
            </Button>
            <h1 className="text-2xl font-bold mt-2">{exercise.name}</h1>
            <p className="text-sm text-muted-foreground">
              {exercise.muscle_group}
              {exercise.equipment && ` - ${exercise.equipment}`}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress Log</CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  No data logged yet
                </p>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 pr-3 text-left font-medium whitespace-nowrap">
                          Week
                        </th>
                        {Array.from({ length: maxSetCount }, (_, i) => (
                          <th
                            key={i}
                            className="py-2 px-2 text-center font-medium whitespace-nowrap"
                          >
                            Set {i + 1}
                          </th>
                        ))}
                        <th className="py-2 px-2 text-center font-medium whitespace-nowrap">
                          Max
                        </th>
                        <th className="py-2 pl-2 text-center font-medium whitespace-nowrap">
                          Warmup
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.yearWeek} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap">
                            {row.yearWeek}
                          </td>
                          {Array.from({ length: maxSetCount }, (_, i) => {
                            const s = row.workingSets[i];
                            return (
                              <td
                                key={i}
                                className="py-2 px-2 text-center whitespace-nowrap"
                              >
                                {s ? (
                                  <span className="font-mono text-xs">
                                    {s.weight}&times;{s.reps}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    --
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-2 px-2 text-center whitespace-nowrap">
                            {row.maxWeight != null ? (
                              <span className="font-mono text-xs font-semibold">
                                {row.maxWeight} kg
                              </span>
                            ) : (
                              <span className="text-muted-foreground">--</span>
                            )}
                          </td>
                          <td className="py-2 pl-2 text-center whitespace-nowrap">
                            {row.warmupRange ? (
                              <span className="font-mono text-xs">
                                {row.warmupRange} kg
                              </span>
                            ) : (
                              <span className="text-muted-foreground">--</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
