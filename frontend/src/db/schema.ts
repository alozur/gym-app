import Dexie, { type Table } from "dexie";

// ---------------------------------------------------------------------------
// Sync status
// ---------------------------------------------------------------------------

const SYNC_STATUS = {
  pending: "pending",
  synced: "synced",
} as const;

type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];

export { SYNC_STATUS };
export type { SyncStatus };

// ---------------------------------------------------------------------------
// Table interfaces — mirrors PostgreSQL schema + sync_status
// ---------------------------------------------------------------------------

export interface DbUser {
  id: string;
  email: string;
  display_name: string;
  preferred_unit: "kg" | "lbs";
  created_at: string;
  sync_status: SyncStatus;
}

export interface DbExercise {
  id: string;
  user_id: string | null;
  name: string;
  muscle_group: string;
  equipment: string | null;
  is_custom: boolean;
  youtube_url: string | null;
  notes: string | null;
  created_at: string;
  sync_status: SyncStatus;
}

export interface DbExerciseSubstitution {
  id: string;
  exercise_id: string;
  substitute_exercise_id: string;
  priority: number;
  sync_status: SyncStatus;
}

export interface DbWorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  sync_status: SyncStatus;
}

export interface DbTemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  week_type: "normal" | "deload";
  order: number;
  working_sets: number;
  min_reps: number;
  max_reps: number;
  early_set_rpe_min: number;
  early_set_rpe_max: number;
  last_set_rpe_min: number;
  last_set_rpe_max: number;
  rest_period: string;
  intensity_technique: string | null;
  min_warmup_sets: number;
  max_warmup_sets: number;
  sync_status: SyncStatus;
}

export interface DbWorkoutSession {
  id: string;
  user_id: string;
  template_id: string | null;
  year_week: string | null;
  week_type: "normal" | "deload";
  started_at: string;
  finished_at: string | null;
  notes: string | null;
  sync_status: SyncStatus;
}

export interface DbWorkoutSet {
  id: string;
  session_id: string;
  exercise_id: string;
  set_type: "warmup" | "working";
  set_number: number;
  reps: number;
  weight: number;
  rpe: number | null;
  notes: string | null;
  created_at: string;
  sync_status: SyncStatus;
}

export interface DbExerciseProgress {
  id: string;
  user_id: string;
  exercise_id: string;
  year_week: string;
  max_weight: number;
  warmup_weight_range: string | null;
  warmup_sets_done: number | null;
  created_at: string;
  sync_status: SyncStatus;
}

// ---------------------------------------------------------------------------
// Dexie database class
// ---------------------------------------------------------------------------

export class GymTrackerDB extends Dexie {
  users!: Table<DbUser, string>;
  exercises!: Table<DbExercise, string>;
  exerciseSubstitutions!: Table<DbExerciseSubstitution, string>;
  workoutTemplates!: Table<DbWorkoutTemplate, string>;
  templateExercises!: Table<DbTemplateExercise, string>;
  workoutSessions!: Table<DbWorkoutSession, string>;
  workoutSets!: Table<DbWorkoutSet, string>;
  exerciseProgress!: Table<DbExerciseProgress, string>;

  constructor() {
    super("GymTrackerDB");

    this.version(1).stores({
      users: "id, email, sync_status",
      exercises: "id, user_id, muscle_group, is_custom, sync_status",
      exerciseSubstitutions:
        "id, exercise_id, substitute_exercise_id, sync_status",
      workoutTemplates: "id, user_id, sync_status",
      templateExercises: "id, template_id, exercise_id, week_type, sync_status",
      workoutSessions:
        "id, user_id, template_id, year_week, week_type, sync_status",
      workoutSets: "id, session_id, exercise_id, set_type, sync_status",
      exerciseProgress:
        "id, user_id, exercise_id, year_week, [user_id+exercise_id+year_week], sync_status",
    });
  }
}
