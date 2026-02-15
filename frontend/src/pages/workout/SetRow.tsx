import { Input } from "@/components/ui/input";
import type { SetEntry } from "./types";

interface SetRowProps {
  entry: SetEntry;
  onChange: (field: "weight" | "reps" | "rpe", value: string) => void;
}

export function SetRow({ entry, onChange }: SetRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 text-center text-xs text-muted-foreground shrink-0">
        {entry.setNumber}
      </span>
      <Input
        type="number"
        inputMode="decimal"
        placeholder="kg"
        value={entry.weight}
        onChange={(e) => onChange("weight", e.target.value)}
        className="min-h-[44px] flex-1"
      />
      <Input
        type="number"
        inputMode="numeric"
        placeholder="reps"
        value={entry.reps}
        onChange={(e) => onChange("reps", e.target.value)}
        className="min-h-[44px] flex-1"
      />
    </div>
  );
}
