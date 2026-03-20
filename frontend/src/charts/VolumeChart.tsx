import { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { db } from "@/db/index";

interface SessionVolume {
  date: string;
  sortKey: string;
  volume: number;
  label: string;
  sessionName: string;
}

type SessionRange = "7" | "30" | "all";

const RANGE_OPTIONS: { value: SessionRange; label: string }[] = [
  { value: "7", label: "Last 7" },
  { value: "30", label: "Last 30" },
  { value: "all", label: "All" },
];

const SESSION_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

export default function VolumeChart() {
  const [data, setData] = useState<SessionVolume[]>([]);
  const [range, setRange] = useState<SessionRange>("7");
  const [selectedSession, setSelectedSession] = useState<string>("all");

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

      // Look up session dates and names
      const sessionIds = [...bySession.keys()];
      const sessions =
        sessionIds.length > 0
          ? await db.workoutSessions.where("id").anyOf(sessionIds).toArray()
          : [];
      if (cancelled) return;

      // Resolve session names from templates or phase workouts
      const templateIds = [
        ...new Set(
          sessions
            .map((s) => s.template_id)
            .filter((id): id is string => id !== null),
        ),
      ];
      const phaseWorkoutIds = [
        ...new Set(
          sessions
            .map((s) => s.phase_workout_id)
            .filter((id): id is string => id !== null),
        ),
      ];

      const templates =
        templateIds.length > 0
          ? await db.workoutTemplates.where("id").anyOf(templateIds).toArray()
          : [];
      const phaseWorkouts =
        phaseWorkoutIds.length > 0
          ? await db.phaseWorkouts.where("id").anyOf(phaseWorkoutIds).toArray()
          : [];
      if (cancelled) return;

      const templateNameMap = new Map(templates.map((t) => [t.id, t.name]));
      const phaseWorkoutNameMap = new Map(
        phaseWorkouts.map((w) => [w.id, w.name]),
      );

      const points: SessionVolume[] = [];
      for (const sess of sessions) {
        if (!sess.finished_at) continue;
        const vol = bySession.get(sess.id) ?? 0;
        const d = new Date(sess.started_at);
        const sessionName = sess.template_id
          ? (templateNameMap.get(sess.template_id) ?? "Unknown")
          : sess.phase_workout_id
            ? (phaseWorkoutNameMap.get(sess.phase_workout_id) ?? "Unknown")
            : "Ad-hoc";
        points.push({
          date: `${d.getDate()}/${d.getMonth() + 1}`,
          sortKey: sess.started_at,
          volume: Math.round(vol),
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          sessionName,
        });
      }

      points.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      if (!cancelled) setData(points);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Unique session names for filter
  const sessionNames = useMemo(() => {
    const names = [...new Set(data.map((d) => d.sessionName))];
    names.sort();
    return names;
  }, [data]);

  const filteredData = useMemo(() => {
    let filtered = data;
    if (selectedSession !== "all") {
      filtered = filtered.filter((d) => d.sessionName === selectedSession);
    }
    const count = range === "all" ? filtered.length : parseInt(range);
    return filtered.slice(-count);
  }, [data, range, selectedSession]);

  // Build chart data: when comparing same sessions, use session name as bar key
  const chartData = useMemo(() => {
    if (selectedSession !== "all") {
      // Single session type: simple volume bars
      return filteredData.map((d) => ({
        date: d.date,
        volume: d.volume,
      }));
    }

    // All sessions: group by date, with one bar per session type
    const grouped = new Map<
      string,
      { date: string; [key: string]: number | string }
    >();
    for (const d of filteredData) {
      const key = d.sortKey; // unique per session
      grouped.set(key, {
        date: d.date,
        [d.sessionName]: d.volume,
      });
    }
    return [...grouped.values()];
  }, [filteredData, selectedSession]);

  // Session names present in current filtered data (for bar keys)
  const activeSessionNames = useMemo(() => {
    if (selectedSession !== "all") return ["volume"];
    return [...new Set(filteredData.map((d) => d.sessionName))];
  }, [filteredData, selectedSession]);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No volume data yet
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Session filter */}
      {sessionNames.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setSelectedSession("all")}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              selectedSession === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {sessionNames.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setSelectedSession(name)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                selectedSession === name
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Range filter */}
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
        <BarChart data={chartData}>
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
          {activeSessionNames.length > 1 && (
            <Legend wrapperStyle={{ fontSize: 10 }} />
          )}
          {activeSessionNames.map((name, idx) => (
            <Bar
              key={name}
              dataKey={name}
              fill={SESSION_COLORS[idx % SESSION_COLORS.length]}
              radius={[4, 4, 0, 0]}
              name={name === "volume" ? "Volume (kg)" : name}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
