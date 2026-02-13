import { useState, useEffect } from "react";
import { db, type DbExercise } from "@/db/index";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProgressChart from "@/charts/ProgressChart";
import VolumeChart from "@/charts/VolumeChart";
import RecordsList from "@/charts/RecordsList";
import WorkoutHistory from "@/charts/WorkoutHistory";

const TABS = ["Progress", "Volume", "Records", "History"] as const;
type Tab = (typeof TABS)[number];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("Progress");
  const [exercises, setExercises] = useState<DbExercise[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const allExercises = await db.exercises.toArray();
      if (cancelled) return;
      allExercises.sort((a, b) => a.name.localeCompare(b.name));
      setExercises(allExercises);
      if (allExercises.length > 0) {
        setSelectedExerciseId(allExercises[0].id);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <main className="mx-auto max-w-md px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">Dashboard</h1>

        <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
          {TABS.map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? "default" : "ghost"}
              size="sm"
              className="flex-1 text-xs"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </Button>
          ))}
        </div>

        {activeTab === "Progress" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Weight Progression</CardTitle>
            </CardHeader>
            <CardContent>
              {exercises.length > 0 ? (
                <>
                  <select
                    value={selectedExerciseId}
                    onChange={(e) => setSelectedExerciseId(e.target.value)}
                    className="mb-4 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {exercises.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name}
                      </option>
                    ))}
                  </select>
                  <ProgressChart exerciseId={selectedExerciseId} />
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No exercises found
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "Volume" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Volume by Muscle Group
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VolumeChart />
            </CardContent>
          </Card>
        )}

        {activeTab === "Records" && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Personal Records</h2>
            <RecordsList />
          </div>
        )}

        {activeTab === "History" && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Workout History</h2>
            <WorkoutHistory />
          </div>
        )}
      </main>
    </div>
  );
}
