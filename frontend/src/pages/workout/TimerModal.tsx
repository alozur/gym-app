import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

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
  } catch { /* Audio not available */ }
}

function playCountdownTick() {
  playTone(440, 0.1, 0.2);
}

function playGoSound() {
  try {
    const ctx = new AudioContext();
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
  } catch { /* Audio not available */ }
}

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
  } catch { /* Audio not available */ }
}

type Phase = "countdown" | "active" | "overtime";

interface TimerModalProps {
  targetSeconds: number;
  exerciseName: string;
  onClose: (actualSeconds: number | null) => void;
}

export function TimerModal({ targetSeconds, exerciseName, onClose }: TimerModalProps) {
  const [phase, setPhase] = useState<Phase>("countdown");
  const [display, setDisplay] = useState(5);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>("countdown");
  const countdownEndRef = useRef(0);
  const activeEndRef = useRef(0);
  const overtimeStartRef = useRef(0);
  const lastTickRef = useRef(-1);

  const clear = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Single interval drives all phases via refs
  useEffect(() => {
    phaseRef.current = "countdown";
    setPhase("countdown");
    setDisplay(5);
    lastTickRef.current = -1;

    const now = Date.now();
    countdownEndRef.current = now + 5000;
    activeEndRef.current = now + 5000 + targetSeconds * 1000;
    playCountdownTick();

    intervalRef.current = setInterval(() => {
      const t = Date.now();

      if (phaseRef.current === "countdown") {
        const left = Math.max(0, Math.ceil((countdownEndRef.current - t) / 1000));
        setDisplay(left);
        if (left !== lastTickRef.current && left > 0) {
          lastTickRef.current = left;
          playCountdownTick();
        }
        if (t >= countdownEndRef.current) {
          phaseRef.current = "active";
          setPhase("active");
          setDisplay(targetSeconds);
          lastTickRef.current = -1;
          playGoSound();
        }
      } else if (phaseRef.current === "active") {
        const remaining = Math.max(0, Math.ceil((activeEndRef.current - t) / 1000));
        setDisplay(remaining);
        if (t >= activeEndRef.current) {
          phaseRef.current = "overtime";
          overtimeStartRef.current = t;
          setPhase("overtime");
          setDisplay(0);
          playFinishSound();
        }
      } else {
        const over = Math.floor((t - overtimeStartRef.current) / 1000);
        setDisplay(over);
      }
    }, 200);

    return () => clear();
  }, [targetSeconds, clear]);

  function handleStop() {
    clear();
    const p = phaseRef.current;
    if (p === "countdown") {
      onClose(null);
    } else if (p === "active") {
      const remaining = Math.max(0, Math.ceil((activeEndRef.current - Date.now()) / 1000));
      const done = targetSeconds - remaining;
      onClose(done > 0 ? done : null);
    } else {
      const over = Math.floor((Date.now() - overtimeStartRef.current) / 1000);
      onClose(targetSeconds + over);
    }
  }

  const absVal = Math.abs(display);
  const minutes = Math.floor(absVal / 60);
  const seconds = absVal % 60;
  const timeStr = `${minutes}:${String(seconds).padStart(2, "0")}`;

  let bgClass: string;
  let label: string;
  let timeDisplay: string;

  if (phase === "countdown") {
    bgClass = "bg-amber-500";
    label = "GET READY";
    timeDisplay = timeStr;
  } else if (phase === "active") {
    bgClass = "bg-emerald-500";
    label = "GO!";
    timeDisplay = timeStr;
  } else {
    bgClass = "bg-red-500";
    label = "TIME!";
    timeDisplay = `-${timeStr}`;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center ${bgClass} transition-colors duration-500`}
    >
      <p className="text-white/80 text-lg font-medium mb-2 truncate max-w-[80%] text-center">
        {exerciseName}
      </p>

      <p className="text-white text-2xl font-bold tracking-widest mb-8">
        {label}
      </p>

      <p className="text-white font-mono text-8xl font-bold tabular-nums tracking-wider">
        {timeDisplay}
      </p>

      <p className="text-white/60 text-sm mt-4">
        {phase === "countdown"
          ? "Preparing..."
          : phase === "active"
            ? `${targetSeconds}s target`
            : "Overtime"}
      </p>

      <button
        type="button"
        onClick={handleStop}
        className="mt-16 h-20 w-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border-2 border-white/40 active:scale-95 transition-transform"
        aria-label="Stop timer"
      >
        {phase === "countdown" ? (
          <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        )}
      </button>

      <p className="text-white/50 text-xs mt-4">
        {phase === "countdown" ? "Tap to cancel" : "Tap to stop"}
      </p>
    </div>,
    document.body,
  );
}
