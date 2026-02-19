/**
 * Fetch data from the backend API and populate Dexie tables.
 * Called after login to seed the local database for offline-first usage.
 */
import { db } from "./index";
import { api } from "@/api/client";
import type {
  ExerciseResponse,
  TemplateResponse,
  TemplateDetailResponse,
  ProgramResponse,
  ProgramDetailResponse,
  SessionResponse,
  SessionDetailResponse,
  ProgressDetailResponse,
} from "@/types";

export async function hydrateFromApi(userId: string): Promise<void> {
  try {
    // Clear all local data first to avoid duplicates / stale records
    await Promise.all(db.tables.map((table) => table.clear()));

    // Fetch exercises (includes substitutions)
    const exercises = await api.get<ExerciseResponse[]>("/exercises");

    await db.exercises.bulkPut(
      exercises.map((e) => ({
        id: e.id,
        user_id: e.is_custom ? userId : null,
        name: e.name,
        muscle_group: e.muscle_group,
        equipment: e.equipment,
        is_custom: e.is_custom,
        youtube_url: e.youtube_url,
        notes: e.notes,
        created_at: e.created_at,
        sync_status: "synced" as const,
      })),
    );

    // Flatten substitutions from all exercises
    const substitutions = exercises.flatMap((e) =>
      e.substitutions.map((s) => ({
        id: s.id,
        exercise_id: e.id,
        substitute_exercise_id: s.substitute_exercise_id,
        priority: s.priority,
        sync_status: "synced" as const,
      })),
    );
    if (substitutions.length > 0) {
      await db.exerciseSubstitutions.bulkPut(substitutions);
    }

    // Fetch templates and their exercises
    const templates = await api.get<TemplateResponse[]>("/templates");
    if (templates.length > 0) {
      await db.workoutTemplates.bulkPut(
        templates.map((t) => ({
          id: t.id,
          user_id: userId,
          name: t.name,
          created_at: t.created_at,
          sync_status: "synced" as const,
        })),
      );

      // Fetch template exercises for each template
      const allTemplateExercises = await Promise.all(
        templates.map((t) =>
          api.get<TemplateDetailResponse>(`/templates/${t.id}`),
        ),
      );

      const templateExerciseRecords = allTemplateExercises.flatMap((td) =>
        td.template_exercises.map((te) => ({
          id: te.id,
          template_id: td.id,
          exercise_id: te.exercise_id,
          week_type: te.week_type as "normal" | "deload",
          order: te.order,
          working_sets: te.working_sets,
          min_reps: te.min_reps,
          max_reps: te.max_reps,
          early_set_rpe_min: te.early_set_rpe_min,
          early_set_rpe_max: te.early_set_rpe_max,
          last_set_rpe_min: te.last_set_rpe_min,
          last_set_rpe_max: te.last_set_rpe_max,
          rest_period: te.rest_period,
          intensity_technique: te.intensity_technique,
          warmup_sets: te.warmup_sets,
          parent_exercise_id: null,
          sync_status: "synced" as const,
        })),
      );

      if (templateExerciseRecords.length > 0) {
        await db.templateExercises.bulkPut(templateExerciseRecords);
      }
    }

    // Fetch programs and their routines
    const programs = await api.get<ProgramResponse[]>("/programs");
    if (programs.length > 0) {
      await db.programs.bulkPut(
        programs.map((p) => ({
          id: p.id,
          user_id: userId,
          name: p.name,
          deload_every_n_weeks: p.deload_every_n_weeks,
          is_active: p.is_active,
          started_at: p.started_at,
          current_routine_index: p.current_routine_index,
          weeks_completed: p.weeks_completed,
          last_workout_at: p.last_workout_at,
          created_at: p.created_at,
          sync_status: "synced" as const,
        })),
      );

      const allProgramDetails = await Promise.all(
        programs.map((p) =>
          api.get<ProgramDetailResponse>(`/programs/${p.id}`),
        ),
      );

      const routineRecords = allProgramDetails.flatMap((pd) =>
        pd.routines.map((r) => ({
          id: r.id,
          program_id: pd.id,
          template_id: r.template_id,
          order: r.order,
          sync_status: "synced" as const,
        })),
      );

      if (routineRecords.length > 0) {
        await db.programRoutines.bulkPut(routineRecords);
      }
    }

    // Fetch sessions and their sets
    const sessions = await api.get<SessionResponse[]>("/sessions");
    if (sessions.length > 0) {
      await db.workoutSessions.bulkPut(
        sessions.map((s) => ({
          id: s.id,
          user_id: userId,
          template_id: s.template_id,
          year_week: s.year_week,
          week_type: s.week_type as "normal" | "deload",
          started_at: s.started_at,
          finished_at: s.finished_at,
          notes: s.notes,
          program_id: s.program_id,
          sync_status: "synced" as const,
        })),
      );

      // Fetch sets for each session
      const allSessionDetails = await Promise.all(
        sessions.map((s) =>
          api.get<SessionDetailResponse>(`/sessions/${s.id}`),
        ),
      );

      const setRecords = allSessionDetails.flatMap((sd) =>
        sd.sets.map((set) => ({
          id: set.id,
          session_id: sd.id,
          exercise_id: set.exercise_id,
          set_type: set.set_type as "warmup" | "working",
          set_number: set.set_number,
          reps: set.reps,
          weight: set.weight,
          rpe: set.rpe,
          notes: set.notes,
          created_at: set.created_at,
          sync_status: "synced" as const,
        })),
      );

      if (setRecords.length > 0) {
        await db.workoutSets.bulkPut(setRecords);
      }
    }

    // Fetch exercise progress
    const progress = await api.get<ProgressDetailResponse[]>("/progress");
    if (progress.length > 0) {
      await db.exerciseProgress.bulkPut(
        progress.map((p) => ({
          id: p.id,
          user_id: userId,
          exercise_id: p.exercise_id,
          year_week: p.year_week,
          max_weight: p.max_weight,
          created_at: p.created_at,
          sync_status: "synced" as const,
        })),
      );
    }
  } catch {
    // Hydration is best-effort — data will load from API on individual pages
  }
}
