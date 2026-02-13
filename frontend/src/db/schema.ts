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
  warmup_sets: number;
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
  program_id: string | null;
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
  created_at: string;
  sync_status: SyncStatus;
}

export interface DbProgram {
  id: string;
  user_id: string;
  name: string;
  deload_every_n_weeks: number;
  is_active: boolean;
  started_at: string | null;
  current_routine_index: number;
  weeks_completed: number;
  last_workout_at: string | null;
  created_at: string;
  sync_status: SyncStatus;
}

export interface DbProgramRoutine {
  id: string;
  program_id: string;
  template_id: string;
  order: number;
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
  programs!: Table<DbProgram, string>;
  programRoutines!: Table<DbProgramRoutine, string>;

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

    this.version(2)
      .stores({
        // Index definitions unchanged — Dexie only needs store defs when
        // indexes change. We keep them identical so no tables are recreated.
        users: "id, email, sync_status",
        exercises: "id, user_id, muscle_group, is_custom, sync_status",
        exerciseSubstitutions:
          "id, exercise_id, substitute_exercise_id, sync_status",
        workoutTemplates: "id, user_id, sync_status",
        templateExercises:
          "id, template_id, exercise_id, week_type, sync_status",
        workoutSessions:
          "id, user_id, template_id, year_week, week_type, sync_status",
        workoutSets: "id, session_id, exercise_id, set_type, sync_status",
        exerciseProgress:
          "id, user_id, exercise_id, year_week, [user_id+exercise_id+year_week], sync_status",
      })
      .upgrade((tx) => {
        // Migrate templateExercises: replace min/max warmup with single warmup_sets
        return tx
          .table("templateExercises")
          .toCollection()
          .modify((te: Record<string, unknown>) => {
            const max = (te["max_warmup_sets"] as number) ?? 2;
            te["warmup_sets"] = max;
            delete te["min_warmup_sets"];
            delete te["max_warmup_sets"];
          })
          .then(() =>
            tx
              .table("exerciseProgress")
              .toCollection()
              .modify((p: Record<string, unknown>) => {
                delete p["warmup_weight_range"];
                delete p["warmup_sets_done"];
              }),
          );
      });

    this.version(3)
      .stores({
        users: "id, email, sync_status",
        exercises: "id, user_id, muscle_group, is_custom, sync_status",
        exerciseSubstitutions:
          "id, exercise_id, substitute_exercise_id, sync_status",
        workoutTemplates: "id, user_id, sync_status",
        templateExercises:
          "id, template_id, exercise_id, week_type, sync_status",
        workoutSessions:
          "id, user_id, template_id, year_week, week_type, program_id, sync_status",
        workoutSets: "id, session_id, exercise_id, set_type, sync_status",
        exerciseProgress:
          "id, user_id, exercise_id, year_week, [user_id+exercise_id+year_week], sync_status",
        programs: "id, user_id, is_active, sync_status",
        programRoutines: "id, program_id, template_id, sync_status",
      })
      .upgrade((tx) => {
        return tx
          .table("workoutSessions")
          .toCollection()
          .modify((session: Record<string, unknown>) => {
            if (!("program_id" in session)) {
              session["program_id"] = null;
            }
          });
      });
  }
}
