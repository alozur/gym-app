import { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { db } from "@/db/index";
import { useUnitPreference } from "@/hooks/useUnitPreference";

interface ProgressChartProps {
  exerciseId: string;
}

interface ChartPoint {
  yearWeek: string;
  maxWeight: number;
}

export default function ProgressChart({ exerciseId }: ProgressChartProps) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const { unit, convertWeight } = useUnitPreference();

  useEffect(() => {
    if (!exerciseId) return;
    let cancelled = false;

    async function load() {
      const records = await db.exerciseProgress
        .where("exercise_id")
        .equals(exerciseId)
        .toArray();
      if (cancelled) return;

      const sorted = records.sort((a, b) =>
        a.year_week.localeCompare(b.year_week),
      );
      setData(
        sorted.map((r) => ({ yearWeek: r.year_week, maxWeight: r.max_weight })),
      );
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  const displayData = data.map((d) => ({
    ...d,
    maxWeight: convertWeight(d.maxWeight, "kg"),
  }));

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No progress data yet
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={displayData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="yearWeek"
          tick={{ fontSize: 11 }}
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
        <Line
          type="monotone"
          dataKey="maxWeight"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={{ r: 3 }}
          name={`Max Weight (${unit})`}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
