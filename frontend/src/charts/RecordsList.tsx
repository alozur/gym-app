import { useState, useEffect } from "react";
import { db, type DbExercise } from "@/db/index";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";

interface PersonalRecord {
  exerciseName: string;
  maxWeight: number;
  reps: number;
  estimated1RM: number;
}

interface RecordsListProps {
  exerciseId?: string;
}

/** Epley formula: 1RM = weight × (1 + reps / 30) */
function estimate1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

export default function RecordsList({ exerciseId }: RecordsListProps) {
  const [records, setRecords] = useState<PersonalRecord[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Get working sets — filtered by exercise if provided
      const allSets = exerciseId
        ? await db.workoutSets
            .where("exercise_id")
            .equals(exerciseId)
            .and((s) => s.set_type === "working")
            .toArray()
        : await db.workoutSets
            .where("set_type")
            .equals("working")
            .toArray();

      const exerciseIds = exerciseId
        ? [exerciseId]
        : [...new Set(allSets.map((s) => s.exercise_id))];
      const exercises = exerciseIds.length > 0
        ? await db.exercises.where("id").anyOf(exerciseIds).toArray()
        : [];
      if (cancelled) return;

      const exerciseMap = new Map<string, DbExercise>(
        exercises.map((e) => [e.id, e]),
      );

      // For each exercise, find the set that gives the highest estimated 1RM
      const bestMap = new Map<string, { weight: number; reps: number; e1rm: number }>();
      for (const s of allSets) {
        if (s.weight <= 0 || s.reps <= 0) continue;
        const e1rm = estimate1RM(s.weight, s.reps);
        const current = bestMap.get(s.exercise_id);
        if (!current || e1rm > current.e1rm) {
          bestMap.set(s.exercise_id, { weight: s.weight, reps: s.reps, e1rm });
        }
      }

      const result: PersonalRecord[] = [];
      for (const [exId, record] of bestMap) {
        const exercise = exerciseMap.get(exId);
        if (exercise) {
          result.push({
            exerciseName: exercise.name,
            maxWeight: record.weight,
            reps: record.reps,
            estimated1RM: Math.round(record.e1rm * 10) / 10,
          });
        }
      }
      result.sort((a, b) => b.estimated1RM - a.estimated1RM);

      if (!cancelled) setRecords(result);
    }

    void load();
    return () => { cancelled = true; };
  }, [exerciseId]);

  if (records.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
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
              {!exerciseId && (
                <p className="truncate text-sm font-medium">{pr.exerciseName}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Best set: {pr.maxWeight} kg x {pr.reps} {pr.reps === 1 ? "rep" : "reps"}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-sm font-semibold">
                {pr.estimated1RM} kg
              </p>
              <p className="text-[10px] text-muted-foreground">Est. 1RM</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
