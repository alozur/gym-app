import { useState, useEffect } from "react";
import { db, type DbExercise } from "@/db/index";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";

interface PersonalRecord {
  exerciseName: string;
  maxWeight: number;
  yearWeek: string;
}

export default function RecordsList() {
  const [records, setRecords] = useState<PersonalRecord[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const allProgress = await db.exerciseProgress.toArray();
      const exercises = await db.exercises.toArray();
      if (cancelled) return;

      const exerciseMap = new Map<string, DbExercise>(
        exercises.map((e) => [e.id, e]),
      );

      const prMap = new Map<
        string,
        { maxWeight: number; yearWeek: string }
      >();
      for (const p of allProgress) {
        const current = prMap.get(p.exercise_id);
        if (!current || p.max_weight > current.maxWeight) {
          prMap.set(p.exercise_id, {
            maxWeight: p.max_weight,
            yearWeek: p.year_week,
          });
        }
      }

      const result: PersonalRecord[] = [];
      for (const [exerciseId, record] of prMap) {
        const exercise = exerciseMap.get(exerciseId);
        if (exercise) {
          result.push({ exerciseName: exercise.name, ...record });
        }
      }
      result.sort((a, b) => b.maxWeight - a.maxWeight);

      if (!cancelled) setRecords(result);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (records.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No records yet
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {records.map((pr) => (
        <Card key={pr.exerciseName}>
          <CardContent className="flex items-center gap-3 py-3">
            <Trophy className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{pr.exerciseName}</p>
              <p className="text-xs text-muted-foreground">
                Week {pr.yearWeek}
              </p>
            </div>
            <span className="font-mono text-sm font-semibold">
              {pr.maxWeight} kg
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
