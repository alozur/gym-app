import type { DbTemplateExercise, DbExerciseSubstitution } from "@/db/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getYearWeek(date: Date): string {
  const jan1 = new Date(date.getFullYear(), 0, 1);
  const dayOfYear =
    Math.floor((date.getTime() - jan1.getTime()) / 86_400_000) + 1;
  const weekNumber = Math.ceil(dayOfYear / 7);
  return `${date.getFullYear()}-${String(weekNumber).padStart(2, "0")}`;
}

export interface ParsedReps {
  minReps: number;
  maxReps: number;
  isTimed: boolean;
  isEachSide: boolean;
}

export function parseRepsDisplay(reps: string): ParsedReps {
  const trimmed = reps.trim();
  const isEachSide = trimmed.includes("e/s");
  const cleaned = trimmed.replace("e/s", "").trim();
  const isTimed = cleaned.endsWith("s");
  const numStr = isTimed ? cleaned.slice(0, -1).trim() : cleaned;

  if (numStr.includes("-")) {
    const [min, max] = numStr.split("-").map(Number);
    return { minReps: min, maxReps: max, isTimed, isEachSide };
  }

  const val = Number(numStr);
  return { minReps: val, maxReps: val, isTimed, isEachSide };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WeekType = "normal" | "deload";

export interface SubstituteExercise {
  id: string;
  name: string;
  equipment: string | null;
  youtubeUrl: string | null;
  notes: string | null;
  exerciseType: "reps" | "timed";
  prescription: DbTemplateExercise | null;
  lastMaxWeight: number | null;
}

export interface LastSetInfo {
  setNumber: number;
  weight: number;
  reps: number;
  rpe: number | null;
}

export interface ExerciseEntry {
  prescriptionId: string | null;
  exerciseId: string;
  exerciseName: string;
  equipment: string | null;
  youtubeUrl: string | null;
  exerciseNotes: string | null;
  exerciseType: "reps" | "timed";
  prescription: DbTemplateExercise | null;
  lastMaxWeight: number | null;
  warmupCount: number;
  workingSets: SetEntry[];
  substitutions: DbExerciseSubstitution[];
  substituteExercises: SubstituteExercise[];
  lastSets: LastSetInfo[];
  // Phased program fields
  sectionName?: string;
  sectionNotes?: string;
  repsDisplay?: string;
  isEachSide?: boolean;
  restPeriod?: string | null;
}

export interface SetEntry {
  id: string;
  setType: "warmup" | "working";
  setNumber: number;
  weight: string;
  reps: string;
  rpe: string;
  saved: boolean;
}
