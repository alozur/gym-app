import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { db } from "@/db/index";

interface VolumeData {
  muscleGroup: string;
  volume: number;
}

export default function VolumeChart() {
  const [data, setData] = useState<VolumeData[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const workingSets = await db.workoutSets
        .where("set_type")
        .equals("working")
        .toArray();

      if (cancelled || workingSets.length === 0) return;

      const exercises = await db.exercises.toArray();
      const exerciseMap = new Map(exercises.map((e) => [e.id, e]));

      const volumeMap = new Map<string, number>();
      for (const set of workingSets) {
        const exercise = exerciseMap.get(set.exercise_id);
        if (!exercise) continue;
        const group = exercise.muscle_group;
        const vol = set.reps * set.weight;
        volumeMap.set(group, (volumeMap.get(group) ?? 0) + vol);
      }

      const result: VolumeData[] = [];
      for (const [muscleGroup, volume] of volumeMap) {
        result.push({ muscleGroup, volume: Math.round(volume) });
      }
      result.sort((a, b) => b.volume - a.volume);

      if (!cancelled) setData(result);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No volume data yet
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="muscleGroup"
          tick={{ fontSize: 10 }}
          stroke="var(--muted-foreground)"
        />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
          }}
        />
        <Bar
          dataKey="volume"
          fill="var(--chart-2)"
          radius={[4, 4, 0, 0]}
          name="Volume (kg)"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
