import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  db,
  type DbExercise,
  type DbExerciseSubstitution,
  type DbWorkoutSet,
} from "@/db/index";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

export default function Exercises() {
  const navigate = useNavigate();
  const [exercises, setExercises] = useState<DbExercise[]>([]);
  const [substitutions, setSubstitutions] = useState<
    DbExerciseSubstitution[]
  >([]);
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);
  // Map exercise_id -> most recent session's working sets
  const [lastSetsMap, setLastSetsMap] = useState<Map<string, DbWorkoutSet[]>>(
    new Map(),
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [allExercises, allSubs, allSets] = await Promise.all([
        db.exercises.toArray(),
        db.exerciseSubstitutions.toArray(),
        db.workoutSets.toArray(),
      ]);
      if (cancelled) return;

      allExercises.sort((a, b) => a.name.localeCompare(b.name));
      setExercises(allExercises);
      setSubstitutions(allSubs);

      // Build last-session sets per exercise
      // Group working sets by exercise_id, then pick the most recent session
      const byExercise = new Map<string, DbWorkoutSet[]>();
      for (const s of allSets) {
        if (s.set_type !== "working") continue;
        const arr = byExercise.get(s.exercise_id) ?? [];
        arr.push(s);
        byExercise.set(s.exercise_id, arr);
      }

      const lastMap = new Map<string, DbWorkoutSet[]>();
      for (const [exId, sets] of byExercise) {
        // Sort by created_at desc to find the most recent
        sets.sort((a, b) => b.created_at.localeCompare(a.created_at));
        // All sets from the same session as the most recent set
        const latestSessionId = sets[0].session_id;
        const sessionSets = sets
          .filter((s) => s.session_id === latestSessionId)
          .sort((a, b) => a.set_number - b.set_number);
        lastMap.set(exId, sessionSets);
      }
      if (!cancelled) setLastSetsMap(lastMap);

      const groups = new Set(allExercises.map((e) => e.muscle_group));
      setExpandedGroups(groups);
      setIsLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const exerciseNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const ex of exercises) {
      map.set(ex.id, ex.name);
    }
    return map;
  }, [exercises]);

  const subsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const sub of substitutions) {
      const name = exerciseNameMap.get(sub.substitute_exercise_id);
      if (!name) continue;
      const arr = map.get(sub.exercise_id) ?? [];
      arr.push(name);
      map.set(sub.exercise_id, arr);
    }
    return map;
  }, [substitutions, exerciseNameMap]);

  const filtered = useMemo(() => {
    if (!search.trim()) return exercises;
    const q = search.toLowerCase();
    return exercises.filter((e) => e.name.toLowerCase().includes(q));
  }, [exercises, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, DbExercise[]>();
    for (const ex of filtered) {
      const arr = map.get(ex.muscle_group) ?? [];
      arr.push(ex);
      map.set(ex.muscle_group, arr);
    }
    return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [filtered]);

  function toggleGroup(group: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-28">
        <main className="mx-auto max-w-md px-4 py-6">
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <main className="mx-auto max-w-md px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">Exercises</h1>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {grouped.size === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No exercises found
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {[...grouped.entries()].map(([group, groupExercises]) => (
              <div key={group}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  <span>
                    {group}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({groupExercises.length})
                    </span>
                  </span>
                  {expandedGroups.has(group) ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                {expandedGroups.has(group) && (
                  <div className="mt-1 flex flex-col gap-2">
                    {groupExercises.map((ex) => {
                      const subs = subsMap.get(ex.id);
                      const lastSets = lastSetsMap.get(ex.id);
                      return (
                        <Card
                          key={ex.id}
                          className="cursor-pointer transition-colors hover:bg-muted/50"
                          onClick={() => navigate(`/exercises/${ex.id}/log`)}
                        >
                          <CardContent className="py-3">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {ex.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {ex.muscle_group}
                                  {ex.equipment && ` · ${ex.equipment}`}
                                </p>
                              </div>
                              {ex.youtube_url && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(
                                      ex.youtube_url!,
                                      "_blank",
                                      "noopener,noreferrer",
                                    );
                                  }}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            {/* Last workout data */}
                            {lastSets && lastSets.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className="text-[10px] text-muted-foreground">Last:</span>
                                {lastSets.map((s) => (
                                  <span
                                    key={s.id}
                                    className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                                  >
                                    {s.weight}kg &times; {s.reps}
                                    {s.rpe !== null && ` @${s.rpe}`}
                                  </span>
                                ))}
                              </div>
                            )}
                            {subs && subs.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                <span className="text-[10px] text-muted-foreground">
                                  Subs:
                                </span>
                                {subs.map((name) => (
                                  <span
                                    key={name}
                                    className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
