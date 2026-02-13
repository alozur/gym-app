import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

interface RestTimerProps {
  durationSeconds: number;
  onComplete: () => void;
  onDismiss: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function RestTimer({
  durationSeconds,
  onComplete,
  onDismiss,
}: RestTimerProps) {
  const [remaining, setRemaining] = useState(durationSeconds);

  const handleComplete = useCallback(() => {
    navigator.vibrate?.(200);
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [handleComplete]);

  const progress = remaining / durationSeconds;

  return (
    <div className="fixed bottom-[72px] left-0 right-0 z-40 border-t bg-background px-4 py-3">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {formatTime(remaining)}
        </span>
        <div className="flex-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Rest Timer</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="min-h-[36px] shrink-0"
          onClick={onDismiss}
          type="button"
        >
          Skip
        </Button>
      </div>
    </div>
  );
}
