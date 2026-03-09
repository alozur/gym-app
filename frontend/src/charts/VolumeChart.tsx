import { useState, useEffect, useMemo } from "react";
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
import { useUnitPreference } from "@/hooks/useUnitPreference";

interface SessionVolume {
  date: string;
  sortKey: string;
  volume: number;
  label: string;
}

type SessionRange = "7" | "30" | "all";

const RANGE_OPTIONS: { value: SessionRange; label: string }[] = [
  { value: "7", label: "Last 7" },
  { value: "30", label: "Last 30" },
  { value: "all", label: "All" },
];

export default function VolumeChart() {
  const [data, setData] = useState<SessionVolume[]>([]);
  const [range, setRange] = useState<SessionRange>("7");
  const { unit, convertWeight } = useUnitPreference();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const workingSets = await db.workoutSets
        .where("set_type")
        .equals("working")
        .toArray();
      if (cancelled || workingSets.length === 0) return;

      // Group sets by session
      const bySession = new Map<string, number>();
      for (const s of workingSets) {
        const vol = (s.weight || 1) * s.reps;
        bySession.set(s.session_id, (bySession.get(s.session_id) ?? 0) + vol);
      }

      // Look up session dates
      const sessionIds = [...bySession.keys()];
      const sessions = sessionIds.length > 0
        ? await db.workoutSessions.where("id").anyOf(sessionIds).toArray()
        : [];
      if (cancelled) return;

      const points: SessionVolume[] = [];
      for (const sess of sessions) {
        if (!sess.finished_at) continue;
        const vol = bySession.get(sess.id) ?? 0;
        const d = new Date(sess.started_at);
        points.push({
          date: `${d.getDate()}/${d.getMonth() + 1}`,
          sortKey: sess.started_at,
          volume: Math.round(vol),
          label: `${d.getDate()}/${d.getMonth() + 1}`,
        });
      }

      points.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      if (!cancelled) setData(points);
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const filteredData = useMemo(() => {
    const count = range === "all" ? data.length : parseInt(range);
    const sliced = data.slice(-count);
    return sliced.map((d) => ({
      ...d,
      volume: Math.round(convertWeight(d.volume, "kg")),
    }));
  }, [data, range, convertWeight]);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No volume data yet
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setRange(opt.value)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              range === opt.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={filteredData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            stroke="var(--muted-foreground)"
          />
          <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="volume"
            fill="var(--chart-2)"
            radius={[4, 4, 0, 0]}
            name={`Volume (${unit})`}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
