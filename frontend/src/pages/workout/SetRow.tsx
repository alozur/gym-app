import { useState } from "react";
import { Input } from "@/components/ui/input";
import { TimerModal } from "./TimerModal";
import type { SetEntry } from "./types";

interface SetRowProps {
  entry: SetEntry;
  exerciseType: "reps" | "timed";
  exerciseName?: string;
  onChange: (field: "weight" | "reps" | "rpe", value: string) => void;
}

export function SetRow({
  entry,
  exerciseType,
  exerciseName,
  onChange,
}: SetRowProps) {
  if (exerciseType === "timed") {
    return (
      <TimedSetRow
        entry={entry}
        exerciseName={exerciseName ?? "Exercise"}
        onChange={onChange}
      />
    );
  }

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

function TimedSetRow({
  entry,
  exerciseName,
  onChange,
}: {
  entry: SetEntry;
  exerciseName: string;
  onChange: (field: "weight" | "reps" | "rpe", value: string) => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const target = parseInt(entry.reps, 10);
  const hasTarget = !isNaN(target) && target > 0;

  function handleTimerClose(actualSeconds: number | null) {
    setShowModal(false);
    if (actualSeconds != null && actualSeconds > 0) {
      onChange("reps", String(actualSeconds));
    }
  }

  return (
    <>
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
          placeholder="secs"
          value={entry.reps}
          onChange={(e) => onChange("reps", e.target.value)}
          className="min-h-[44px] w-20 shrink-0"
        />
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={entry.saved || !hasTarget}
          className="h-[44px] w-[44px] flex items-center justify-center rounded-md border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30 disabled:pointer-events-none shrink-0"
          aria-label="Start timer"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>

      {showModal && (
        <TimerModal
          targetSeconds={target}
          exerciseName={exerciseName}
          onClose={handleTimerClose}
        />
      )}
    </>
  );
}
