// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface UserResponse {
  id: string;
  email: string;
  display_name: string;
  preferred_unit: string;
  created_at: string;
}

export interface UserUpdateRequest {
  display_name?: string;
  preferred_unit?: string;
}

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

export interface MessageResponse {
  message: string;
}

// ---------------------------------------------------------------------------
// Exercise
// ---------------------------------------------------------------------------

export interface SubstitutionCreate {
  substitute_exercise_id: string;
  priority: number;
}

export interface SubstitutionResponse {
  id: string;
  substitute_exercise_id: string;
  substitute_exercise_name: string | null;
  priority: number;
}

export interface ExerciseCreate {
  name: string;
  muscle_group: string;
  equipment: string | null;
  youtube_url: string | null;
  notes: string | null;
}

export interface ExerciseResponse {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string | null;
  is_custom: boolean;
  youtube_url: string | null;
  notes: string | null;
  created_at: string;
  substitutions: SubstitutionResponse[];
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

export interface TemplateExerciseCreate {
  exercise_id: string;
  week_type: string;
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
}

export interface TemplateExerciseResponse {
  id: string;
  exercise_id: string;
  week_type: string;
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
}

export interface TemplateCreate {
  name: string;
  template_exercises: TemplateExerciseCreate[];
}

export interface TemplateResponse {
  id: string;
  name: string;
  created_at: string;
}

export interface TemplateDetailResponse {
  id: string;
  name: string;
  created_at: string;
  template_exercises: TemplateExerciseResponse[];
}

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

export interface ProgramRoutineCreate {
  template_id: string;
  order: number;
}

export interface ProgramRoutineResponse {
  id: string;
  template_id: string;
  template_name: string | null;
  order: number;
}

export interface ProgramCreate {
  name: string;
  deload_every_n_weeks: number;
  routines: ProgramRoutineCreate[];
}

export interface ProgramResponse {
  id: string;
  name: string;
  deload_every_n_weeks: number;
  is_active: boolean;
  started_at: string | null;
  current_routine_index: number;
  weeks_completed: number;
  last_workout_at: string | null;
  created_at: string;
  routine_count: number;
}

export interface ProgramDetailResponse extends ProgramResponse {
  routines: ProgramRoutineResponse[];
}

export interface TodayResponse {
  program: ProgramResponse;
  current_routine: ProgramRoutineResponse | null;
  template_name: string | null;
  template_exercises: TemplateExerciseResponse[];
  week_type: string;
  week_number: number;
  is_deload: boolean;
  next_routine_name: string | null;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface SetCreate {
  exercise_id: string;
  set_type: string;
  set_number: number;
  reps: number;
  weight: number;
  rpe: number | null;
  notes: string | null;
}

export interface SetResponse {
  id: string;
  exercise_id: string;
  set_type: string;
  set_number: number;
  reps: number;
  weight: number;
  rpe: number | null;
  notes: string | null;
  created_at: string;
}

export interface SetUpdate {
  reps: number | null;
  weight: number | null;
  rpe: number | null;
  notes: string | null;
}

export interface SessionCreate {
  template_id: string | null;
  week_type: string;
  year_week: string | null;
  program_id: string | null;
}

export interface SessionUpdate {
  finished_at: string | null;
  notes: string | null;
}

export interface SessionResponse {
  id: string;
  template_id: string | null;
  year_week: string | null;
  week_type: string;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
  program_id: string | null;
  synced: boolean;
}

export interface SessionDetailResponse {
  id: string;
  template_id: string | null;
  year_week: string | null;
  week_type: string;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
  program_id: string | null;
  synced: boolean;
  sets: SetResponse[];
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export interface ProgressResponse {
  year_week: string;
  max_weight: number;
}

export interface VolumeResponse {
  year_week: string;
  muscle_group: string;
  total_volume: number;
}

export interface RecordResponse {
  exercise_id: string;
  exercise_name: string;
  max_weight: number;
  max_reps: number;
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export interface SyncSessionData {
  id: string;
  template_id: string | null;
  year_week: string | null;
  week_type: string;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
  program_id: string | null;
}

export interface SyncSetData {
  id: string;
  session_id: string;
  exercise_id: string;
  set_type: string;
  set_number: number;
  reps: number;
  weight: number;
  rpe: number | null;
  notes: string | null;
}

export interface SyncRequest {
  sessions: SyncSessionData[];
  sets: SyncSetData[];
}

export interface SyncResponse {
  synced_sessions: string[];
  synced_sets: string[];
  errors: string[];
}
