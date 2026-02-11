import { useState, useEffect, useMemo } from "react";
import { db, type DbExercise } from "@/db/index";
import { api } from "@/api/client";
import type { ExerciseResponse } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MUSCLE_GROUPS = [
  "All",
  "Chest",
  "Back",
  "Legs",
  "Shoulders",
  "Arms",
  "Core",
] as const;

interface ExercisePickerProps {
  onSelect: (exercise: DbExercise) => void;
  excludeIds?: string[];
}

export function ExercisePicker({ onSelect, excludeIds = [] }: ExercisePickerProps) {
  const [exercises, setExercises] = useState<DbExercise[]>([]);
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState<string>("All");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadExercises() {
      setIsLoading(true);

      // Try Dexie first
      const local = await db.exercises.toArray();

      if (local.length > 0) {
        if (!cancelled) {
          setExercises(local);
          setIsLoading(false);
        }
        return;
      }

      // Fall back to API
      try {
        const remote = await api.get<ExerciseResponse[]>("/exercises");
        const mapped: DbExercise[] = remote.map((e) => ({
          id: e.id,
          user_id: null,
          name: e.name,
          muscle_group: e.muscle_group,
          equipment: e.equipment,
          is_custom: e.is_custom,
          youtube_url: e.youtube_url,
          notes: e.notes,
          created_at: e.created_at,
          sync_status: "synced" as const,
        }));

        // Store in Dexie for future offline use
        await db.exercises.bulkPut(mapped);

        if (!cancelled) {
          setExercises(mapped);
        }
      } catch {
        // Offline and no cached data - show empty state
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadExercises();
    return () => {
      cancelled = true;
    };
  }, []);

  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return exercises.filter((e) => {
      if (excludeSet.has(e.id)) return false;
      if (muscleFilter !== "All" && e.muscle_group !== muscleFilter) return false;
      if (query && !e.name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [exercises, search, muscleFilter, excludeSet]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Search exercises..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />

      <div className="flex flex-wrap gap-1.5">
        {MUSCLE_GROUPS.map((group) => (
          <Button
            key={group}
            variant={muscleFilter === group ? "default" : "outline"}
            size="xs"
            onClick={() => setMuscleFilter(group)}
            type="button"
          >
            {group}
          </Button>
        ))}
      </div>

      <div className="max-h-64 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No exercises found
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((exercise) => (
              <li key={exercise.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => onSelect(exercise)}
                >
                  <span className="font-medium">{exercise.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {exercise.muscle_group}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
