import { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { db } from "@/db/index";

interface ProgressChartProps {
  exerciseId: string;
}

interface ChartPoint {
  date: string;
  sortKey: string;
  maxWeight: number;
  volume: number;
}

type TimeRange = "6m" | "1y" | "all";

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
  { value: "all", label: "All time" },
];

function getCutoffDate(range: TimeRange): string | null {
  if (range === "all") return null;
  const now = new Date();
  if (range === "6m") now.setMonth(now.getMonth() - 6);
  else now.setFullYear(now.getFullYear() - 1);
  return now.toISOString();
}

export default function ProgressChart({ exerciseId }: ProgressChartProps) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [range, setRange] = useState<TimeRange>("6m");

  useEffect(() => {
    if (!exerciseId) return;
    let cancelled = false;

    async function load() {
      // Get all working sets for this exercise
      const sets = await db.workoutSets
        .where("exercise_id")
        .equals(exerciseId)
        .and((s) => s.set_type === "working")
        .toArray();
      if (cancelled) return;

      // Group sets by session_id
      const bySession = new Map<string, typeof sets>();
      for (const s of sets) {
        let arr = bySession.get(s.session_id);
        if (!arr) {
          arr = [];
          bySession.set(s.session_id, arr);
        }
        arr.push(s);
      }

      // Look up session dates
      const sessionIds = [...bySession.keys()];
      const sessions =
        sessionIds.length > 0
          ? await db.workoutSessions.where("id").anyOf(sessionIds).toArray()
          : [];
      const sessionDateMap = new Map(
        sessions.filter((s) => s.finished_at).map((s) => [s.id, s.started_at]),
      );

      // Build chart points per session
      const points: ChartPoint[] = [];
      for (const [sessionId, sessionSets] of bySession) {
        const dateStr = sessionDateMap.get(sessionId);
        if (!dateStr) continue;

        let maxWeight = 0;
        let volume = 0;
        for (const s of sessionSets) {
          if (s.weight > maxWeight) maxWeight = s.weight;
          volume += (s.weight || 1) * s.reps;
        }

        const d = new Date(dateStr);
        points.push({
          date: `${d.getDate()}/${d.getMonth() + 1}`,
          sortKey: dateStr,
          maxWeight,
          volume,
        });
      }

      // Sort chronologically by actual timestamp
      points.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

      if (!cancelled) setData(points);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  const filteredData = useMemo(() => {
    const cutoff = getCutoffDate(range);
    return cutoff ? data.filter((d) => d.sortKey >= cutoff) : data;
  }, [data, range]);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No progress data yet
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {TIME_RANGES.map((tr) => (
          <button
            key={tr.value}
            type="button"
            onClick={() => setRange(tr.value)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              range === tr.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tr.label}
          </button>
        ))}
      </div>

      {filteredData.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No data in this time range
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              stroke="var(--muted-foreground)"
            />
            <YAxis
              yAxisId="weight"
              tick={{ fontSize: 10 }}
              stroke="var(--chart-1)"
              label={{
                value: "Weight (kg)",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 10, fill: "var(--chart-1)" },
              }}
            />
            <YAxis
              yAxisId="volume"
              orientation="right"
              tick={{ fontSize: 10 }}
              stroke="var(--chart-2)"
              label={{
                value: "Volume (kg)",
                angle: 90,
                position: "insideRight",
                style: { fontSize: 10, fill: "var(--chart-2)" },
              }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="var(--chart-2)"
              opacity={0.3}
              name={"Volume (kg)"}
              radius={[2, 2, 0, 0]}
            />
            <Line
              yAxisId="weight"
              type="monotone"
              dataKey="maxWeight"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ r: 3 }}
              name={"Max Weight (kg)"}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
