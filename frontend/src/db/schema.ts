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
  exercise_type: "reps" | "timed";
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
  user_id: string | null;
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
  parent_exercise_id: string | null;
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
  phase_workout_id: string | null;
  user_program_id: string | null;
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
  user_id: string | null;
  name: string;
  program_type: "rotating" | "phased";
  deload_every_n_weeks: number;
  created_at: string;
  sync_status: SyncStatus;
}

export interface DbUserProgram {
  id: string;
  user_id: string;
  program_id: string;
  is_active: boolean;
  started_at: string | null;
  current_routine_index: number;
  current_phase_index: number;
  current_week_in_phase: number;
  current_day_index: number;
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

export interface DbProgramPhase {
  id: string;
  program_id: string;
  name: string;
  description: string | null;
  order: number;
  duration_weeks: number;
  sync_status: SyncStatus;
}

export interface DbPhaseWorkout {
  id: string;
  phase_id: string;
  name: string;
  day_index: number;
  week_number: number;
  sync_status: SyncStatus;
}

export interface DbPhaseWorkoutSection {
  id: string;
  workout_id: string;
  name: string;
  order: number;
  notes: string | null;
  sync_status: SyncStatus;
}

export interface DbPhaseWorkoutExercise {
  id: string;
  section_id: string;
  exercise_id: string;
  order: number;
  working_sets: number;
  reps_display: string;
  rest_period: string | null;
  intensity_technique: string | null;
  warmup_sets: number;
  notes: string | null;
  substitute1_exercise_id: string | null;
  substitute2_exercise_id: string | null;
  sync_status: SyncStatus;
}

export interface DbBodyWeight {
  id: string;
  user_id: string;
  weight: number;
  date: string; // YYYY-MM-DD
  created_at: string;
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
  programPhases!: Table<DbProgramPhase, string>;
  phaseWorkouts!: Table<DbPhaseWorkout, string>;
  phaseWorkoutSections!: Table<DbPhaseWorkoutSection, string>;
  phaseWorkoutExercises!: Table<DbPhaseWorkoutExercise, string>;
  userPrograms!: Table<DbUserProgram, string>;
  bodyWeights!: Table<DbBodyWeight, string>;

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

    this.version(4)
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
          .table("exercises")
          .toCollection()
          .modify((exercise: Record<string, unknown>) => {
            if (!("exercise_type" in exercise)) {
              exercise["exercise_type"] = "reps";
            }
          });
      });

    this.version(5)
      .stores({
        users: "id, email, sync_status",
        exercises: "id, user_id, muscle_group, is_custom, sync_status",
        exerciseSubstitutions:
          "id, exercise_id, substitute_exercise_id, sync_status",
        workoutTemplates: "id, user_id, sync_status",
        templateExercises:
          "id, template_id, exercise_id, week_type, sync_status",
        workoutSessions:
          "id, user_id, template_id, year_week, week_type, program_id, phase_workout_id, sync_status",
        workoutSets: "id, session_id, exercise_id, set_type, sync_status",
        exerciseProgress:
          "id, user_id, exercise_id, year_week, [user_id+exercise_id+year_week], sync_status",
        programs: "id, user_id, is_active, sync_status",
        programRoutines: "id, program_id, template_id, sync_status",
        programPhases: "id, program_id, sync_status",
        phaseWorkouts: "id, phase_id, [phase_id+day_index+week_number], sync_status",
        phaseWorkoutSections: "id, workout_id, sync_status",
        phaseWorkoutExercises: "id, section_id, exercise_id, sync_status",
      })
      .upgrade((tx) => {
        return tx
          .table("programs")
          .toCollection()
          .modify((program: Record<string, unknown>) => {
            if (!("program_type" in program)) {
              program["program_type"] = "rotating";
            }
            if (!("current_phase_index" in program)) {
              program["current_phase_index"] = 0;
            }
            if (!("current_week_in_phase" in program)) {
              program["current_week_in_phase"] = 0;
            }
            if (!("current_day_index" in program)) {
              program["current_day_index"] = 0;
            }
          })
          .then(() =>
            tx
              .table("workoutSessions")
              .toCollection()
              .modify((session: Record<string, unknown>) => {
                if (!("phase_workout_id" in session)) {
                  session["phase_workout_id"] = null;
                }
              }),
          );
      });

    this.version(6)
      .stores({
        users: "id, email, sync_status",
        exercises: "id, user_id, muscle_group, is_custom, sync_status",
        exerciseSubstitutions:
          "id, exercise_id, substitute_exercise_id, sync_status",
        workoutTemplates: "id, user_id, sync_status",
        templateExercises:
          "id, template_id, exercise_id, week_type, sync_status",
        workoutSessions:
          "id, user_id, template_id, year_week, week_type, program_id, phase_workout_id, user_program_id, sync_status",
        workoutSets: "id, session_id, exercise_id, set_type, sync_status",
        exerciseProgress:
          "id, user_id, exercise_id, year_week, [user_id+exercise_id+year_week], sync_status",
        programs: "id, user_id, sync_status",
        programRoutines: "id, program_id, template_id, sync_status",
        programPhases: "id, program_id, sync_status",
        phaseWorkouts: "id, phase_id, [phase_id+day_index+week_number], sync_status",
        phaseWorkoutSections: "id, workout_id, sync_status",
        phaseWorkoutExercises: "id, section_id, exercise_id, sync_status",
        userPrograms: "id, user_id, program_id, is_active, sync_status",
      })
      .upgrade((tx) => {
        // Move progress fields from programs to userPrograms
        return tx
          .table("programs")
          .toCollection()
          .modify((program: Record<string, unknown>) => {
            // Clean up old progress fields from programs
            delete program["is_active"];
            delete program["started_at"];
            delete program["current_routine_index"];
            delete program["current_phase_index"];
            delete program["current_week_in_phase"];
            delete program["current_day_index"];
            delete program["weeks_completed"];
            delete program["last_workout_at"];
          })
          .then(() =>
            tx
              .table("workoutSessions")
              .toCollection()
              .modify((session: Record<string, unknown>) => {
                if (!("user_program_id" in session)) {
                  session["user_program_id"] = null;
                }
              }),
          );
      });

    // Fix compound index order so week filtering works correctly
    this.version(7).stores({
      phaseWorkouts:
        "id, phase_id, [phase_id+week_number+day_index], sync_status",
    });

    // Add body weight tracking table
    this.version(8).stores({
      bodyWeights: "id, user_id, date",
    });
  }
}
