import { useRef, useState, useCallback } from "react";

interface SwipeableRowProps {
  onDelete: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

const THRESHOLD = 80;
const DELETE_WIDTH = 72;

export function SwipeableRow({ onDelete, disabled, children }: SwipeableRowProps) {
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const rowRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = 0;
    isDragging.current = false;
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    const diff = e.touches[0].clientX - startXRef.current;
    // Only allow swiping left (negative)
    if (diff > 0) {
      setOffset(0);
      return;
    }
    isDragging.current = true;
    const clamped = Math.max(diff, -DELETE_WIDTH - 20);
    currentXRef.current = clamped;
    setOffset(clamped);
  }, [disabled]);

  const handleTouchEnd = useCallback(() => {
    if (disabled || !isDragging.current) return;
    isDragging.current = false;
    if (Math.abs(currentXRef.current) >= THRESHOLD) {
      onDelete();
      setOffset(0);
    } else {
      setOffset(0);
    }
  }, [disabled, onDelete]);

  return (
    <div className="relative overflow-hidden rounded-md">
      {/* Delete background */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-center bg-destructive text-destructive-foreground text-xs font-medium"
        style={{ width: DELETE_WIDTH }}
      >
        Delete
      </div>
      {/* Sliding content */}
      <div
        ref={rowRef}
        className="relative bg-background"
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging.current ? "none" : "transform 200ms ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
