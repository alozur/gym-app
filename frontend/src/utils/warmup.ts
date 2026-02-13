export interface WarmupSet {
  setNumber: number;
  percentage: number;
  weight: number;
  reps: number;
}

const PYRAMID: Record<number, number[]> = {
  1: [0.6],
  2: [0.5, 0.7],
  3: [0.45, 0.65, 0.85],
  4: [0.45, 0.6, 0.75, 0.85],
};

const REPS: Record<number, number[]> = {
  1: [10],
  2: [10, 5],
  3: [10, 5, 3],
  4: [10, 8, 5, 3],
};

function roundTo2_5(value: number): number {
  return Math.round(value / 2.5) * 2.5;
}

/**
 * Calculate warmup sets based on a pyramid scheme.
 * @param count Number of warmup sets (1-4)
 * @param workingWeight The user's last/target working weight
 * @returns Array of warmup set guidance, or null if inputs are invalid
 */
export function calculateWarmupSets(
  count: number,
  workingWeight: number | null,
): WarmupSet[] | null {
  if (!workingWeight || workingWeight <= 0) return null;
  if (count < 1 || count > 4) return null;

  const percentages = PYRAMID[count];
  const reps = REPS[count];

  return percentages.map((pct, i) => ({
    setNumber: i + 1,
    percentage: Math.round(pct * 100),
    weight: roundTo2_5(workingWeight * pct),
    reps: reps[i],
  }));
}
