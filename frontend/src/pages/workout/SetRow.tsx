import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import type { SetEntry } from "./types";

interface SetRowProps {
  entry: SetEntry;
  exerciseType: "reps" | "timed";
  onChange: (field: "weight" | "reps" | "rpe", value: string) => void;
}

export function SetRow({ entry, exerciseType, onChange }: SetRowProps) {
  if (exerciseType === "timed") {
    return <TimedSetRow entry={entry} onChange={onChange} />;
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

/** Play a beep at the given frequency. */
function playTone(frequency: number, duration: number, volume = 0.3) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    setTimeout(() => void ctx.close(), duration * 1000 + 500);
  } catch {
    // Audio not available
  }
}

/** Single low tick for each countdown second. */
function playCountdownTick() {
  playTone(440, 0.1, 0.2);
}

/** Higher-pitched "GO!" sound when exercise starts. */
function playGoSound() {
  try {
    const ctx = new AudioContext();
    // Two rising tones: "ready GO"
    [0, 0.15].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = i === 0 ? 660 : 880;
      gain.gain.value = 0.4;
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.12);
    });
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    // Audio not available
  }
}

/** Three beeps when exercise finishes. */
function playFinishSound() {
  try {
    const ctx = new AudioContext();
    [0, 0.2, 0.4].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.15);
    });
    setTimeout(() => void ctx.close(), 1000);
  } catch {
    // Audio not available
  }
}

type TimerPhase = "idle" | "countdown" | "active" | "finished";

function TimedSetRow({
  entry,
  onChange,
}: {
  entry: SetEntry;
  onChange: (field: "weight" | "reps" | "rpe", value: string) => void;
}) {
  const [phase, setPhase] = useState<TimerPhase>("idle");
  const [displayValue, setDisplayValue] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimeRef = useRef<number>(0);
  const targetRef = useRef<number>(0);
  const lastTickRef = useRef<number>(-1);

  const target = parseInt(entry.reps, 10);
  const hasTarget = !isNaN(target) && target > 0;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startExercise = useCallback(() => {
    setPhase("active");
    playGoSound();
    targetRef.current = target;
    endTimeRef.current = Date.now() + target * 1000;
    setDisplayValue(target);
    lastTickRef.current = -1;

    intervalRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setDisplayValue(left);
      if (left <= 0) {
        clearTimer();
        setPhase("finished");
        playFinishSound();
      }
    }, 200);
  }, [target, clearTimer]);

  const start = useCallback(() => {
    if (!hasTarget) return;

    // 5-second preparation countdown
    setPhase("countdown");
    const countdownEnd = Date.now() + 5000;
    setDisplayValue(5);
    lastTickRef.current = -1;
    playCountdownTick();

    intervalRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((countdownEnd - Date.now()) / 1000));
      setDisplayValue(left);

      // Play tick on each new second
      if (left !== lastTickRef.current && left > 0) {
        lastTickRef.current = left;
        playCountdownTick();
      }

      if (left <= 0) {
        clearTimer();
        startExercise();
      }
    }, 200);
  }, [hasTarget, clearTimer, startExercise]);

  const stop = useCallback(() => {
    clearTimer();
    if (phase === "countdown") {
      // Cancelled during prep — go back to idle
      setPhase("idle");
      setDisplayValue(0);
      return;
    }
    // Stopped during exercise — record actual seconds done
    setPhase("idle");
    const done = targetRef.current - displayValue;
    if (done > 0) {
      onChange("reps", String(done));
    }
  }, [phase, displayValue, onChange, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const isRunning = phase === "countdown" || phase === "active";
  const showValue = isRunning ? displayValue : (hasTarget ? target : 0);
  const minutes = Math.floor(showValue / 60);
  const seconds = showValue % 60;
  const display = `${minutes}:${String(seconds).padStart(2, "0")}`;

  let countdownStyle = "border-input text-muted-foreground";
  if (phase === "countdown") {
    countdownStyle = "border-amber-500 bg-amber-500/10 text-amber-600 font-bold animate-pulse";
  } else if (phase === "active") {
    countdownStyle = displayValue <= 5
      ? "border-red-500 bg-red-500/10 text-red-500 font-bold"
      : "border-primary bg-primary/5 text-primary font-semibold";
  } else if (phase === "finished") {
    countdownStyle = "border-green-500 bg-green-500/10 text-green-600 font-semibold";
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
      {/* Seconds input */}
      <Input
        type="number"
        inputMode="numeric"
        placeholder="secs"
        value={entry.reps}
        onChange={(e) => onChange("reps", e.target.value)}
        disabled={isRunning}
        className="min-h-[44px] w-20 shrink-0"
      />
      {/* Countdown display */}
      <div
        className={`min-h-[44px] w-16 flex flex-col items-center justify-center rounded-md border text-sm font-mono tabular-nums shrink-0 ${countdownStyle}`}
      >
        {phase === "countdown" && (
          <span className="text-[9px] leading-none font-sans font-medium -mb-0.5">GET READY</span>
        )}
        <span>{display}</span>
      </div>
      {/* Play / Stop button */}
      {!isRunning ? (
        <button
          type="button"
          onClick={start}
          disabled={entry.saved || !hasTarget}
          className="h-[44px] w-[44px] flex items-center justify-center rounded-md border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-30 disabled:pointer-events-none shrink-0"
          aria-label="Start timer"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={stop}
          className="h-[44px] w-[44px] flex items-center justify-center rounded-md border border-red-500 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors shrink-0"
          aria-label="Stop timer"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>
      )}
    </div>
  );
}
