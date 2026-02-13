import { describe, it, expect } from "vitest";
import { calculateWarmupSets } from "@/utils/warmup";

describe("calculateWarmupSets", () => {
  it("returns null when workingWeight is null", () => {
    expect(calculateWarmupSets(2, null)).toBeNull();
  });

  it("returns null when workingWeight is 0", () => {
    expect(calculateWarmupSets(2, 0)).toBeNull();
  });

  it("returns null when workingWeight is negative", () => {
    expect(calculateWarmupSets(2, -10)).toBeNull();
  });

  it("returns null when count is 0", () => {
    expect(calculateWarmupSets(0, 100)).toBeNull();
  });

  it("returns null when count is 5", () => {
    expect(calculateWarmupSets(5, 100)).toBeNull();
  });

  it("calculates 1 warmup set at 60%", () => {
    const result = calculateWarmupSets(1, 100);
    expect(result).toEqual([
      { setNumber: 1, percentage: 60, weight: 60, reps: 10 },
    ]);
  });

  it("calculates 2 warmup sets at 50%/70%", () => {
    const result = calculateWarmupSets(2, 100);
    expect(result).toEqual([
      { setNumber: 1, percentage: 50, weight: 50, reps: 10 },
      { setNumber: 2, percentage: 70, weight: 70, reps: 5 },
    ]);
  });

  it("calculates 3 warmup sets at 45%/65%/85%", () => {
    const result = calculateWarmupSets(3, 100);
    expect(result).toEqual([
      { setNumber: 1, percentage: 45, weight: 45, reps: 10 },
      { setNumber: 2, percentage: 65, weight: 65, reps: 5 },
      { setNumber: 3, percentage: 85, weight: 85, reps: 3 },
    ]);
  });

  it("calculates 4 warmup sets at 45%/60%/75%/85%", () => {
    const result = calculateWarmupSets(4, 100);
    expect(result).toEqual([
      { setNumber: 1, percentage: 45, weight: 45, reps: 10 },
      { setNumber: 2, percentage: 60, weight: 60, reps: 8 },
      { setNumber: 3, percentage: 75, weight: 75, reps: 5 },
      { setNumber: 4, percentage: 85, weight: 85, reps: 3 },
    ]);
  });

  it("rounds weights to nearest 2.5 kg", () => {
    const result = calculateWarmupSets(2, 83);
    expect(result).not.toBeNull();
    // 50% of 83 = 41.5 → rounds to 42.5
    expect(result![0].weight).toBe(42.5);
    // 70% of 83 = 58.1 → rounds to 57.5
    expect(result![1].weight).toBe(57.5);
  });

  it("handles small working weights", () => {
    const result = calculateWarmupSets(1, 20);
    expect(result).toEqual([
      { setNumber: 1, percentage: 60, weight: 12.5, reps: 10 },
    ]);
  });
});
