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
import { db, type DbBodyWeight } from "@/db/index";
import { useAuthContext } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface ChartPoint {
  date: string;
  weight: number;
  id: string;
}

export default function BodyWeightChart() {
  const { state } = useAuthContext();
  const userId = state.user?.id ?? "";
  const [entries, setEntries] = useState<ChartPoint[]>([]);
  const [weight, setWeight] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function load() {
    const all = await db.bodyWeights.where("user_id").equals(userId).toArray();
    all.sort((a, b) => a.date.localeCompare(b.date));
    setEntries(
      all.map((e) => ({
        date: formatDate(e.date),
        weight: e.weight,
        id: e.id,
      })),
    );
  }

  useEffect(() => {
    if (userId) void load();
  }, [userId]);

  async function handleAdd() {
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0 || !userId) return;
    setIsSaving(true);

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // Upsert — replace if same date exists
    const existing = await db.bodyWeights
      .where("date")
      .equals(dateStr)
      .and((e) => e.user_id === userId)
      .first();

    const record: DbBodyWeight = {
      id: existing?.id ?? crypto.randomUUID(),
      user_id: userId,
      weight: w,
      date: dateStr,
      created_at: new Date().toISOString(),
    };

    await db.bodyWeights.put(record);
    setWeight("");
    setIsSaving(false);
    void load();
  }

  async function handleDelete(id: string) {
    await db.bodyWeights.delete(id);
    void load();
  }

  const latest = entries.length > 0 ? entries[entries.length - 1] : null;
  const first = entries.length > 1 ? entries[0] : null;
  const diff =
    latest && first
      ? Math.round((latest.weight - first.weight) * 10) / 10
      : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Quick log */}
      <div className="flex gap-2">
        <Input
          type="number"
          inputMode="decimal"
          placeholder="Weight (kg)"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button
          size="sm"
          disabled={isSaving || !weight}
          onClick={() => void handleAdd()}
          className="min-h-[40px]"
        >
          Log
        </Button>
      </div>

      {/* Stats */}
      {latest && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Current:{" "}
            <span className="font-semibold text-foreground">
              {latest.weight} kg
            </span>
          </span>
          {diff !== null && diff !== 0 && (
            <span className={diff < 0 ? "text-emerald-600" : "text-amber-600"}>
              {diff > 0 ? "+" : ""}
              {diff} kg
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      {entries.length > 1 ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={entries}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              stroke="var(--muted-foreground)"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="var(--muted-foreground)"
              domain={["dataMin - 1", "dataMax + 1"]}
            />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="weight"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Weight (kg)"
            />
          </LineChart>
        </ResponsiveContainer>
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No entries yet. Log your weight above.
        </p>
      ) : null}

      {/* Recent entries */}
      {entries.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">Recent</p>
          {entries
            .slice(-5)
            .reverse()
            .map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-md px-3 py-1.5 text-sm hover:bg-muted/50"
              >
                <span className="text-muted-foreground">{e.date}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{e.weight} kg</span>
                  <button
                    type="button"
                    onClick={() => void handleDelete(e.id)}
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${parseInt(d)}/${parseInt(m)}`;
}
