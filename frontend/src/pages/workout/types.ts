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
  prescription: DbTemplateExercise | null;
  lastMaxWeight: number | null;
}

export interface ExerciseEntry {
  prescriptionId: string | null;
  exerciseId: string;
  exerciseName: string;
  equipment: string | null;
  youtubeUrl: string | null;
  exerciseNotes: string | null;
  prescription: DbTemplateExercise | null;
  lastMaxWeight: number | null;
  warmupCount: number;
  workingSets: SetEntry[];
  substitutions: DbExerciseSubstitution[];
  substituteExercises: SubstituteExercise[];
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
