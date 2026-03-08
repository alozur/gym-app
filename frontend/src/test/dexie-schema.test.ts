import { describe, it, expect, beforeEach } from "vitest";
import { GymTrackerDB, SYNC_STATUS } from "@/db/schema";
import type {
  DbUser,
  DbExercise,
  DbExerciseSubstitution,
  DbWorkoutTemplate,
  DbTemplateExercise,
  DbWorkoutSession,
  DbWorkoutSet,
  DbExerciseProgress,
  DbProgram,
  DbProgramRoutine,
  DbUserProgram,
} from "@/db/schema";

let testDb: GymTrackerDB;

beforeEach(async () => {
  // Create a fresh database for each test
  testDb = new GymTrackerDB();
  // Ensure a clean state
  await testDb.delete();
  testDb = new GymTrackerDB();
});

describe("GymTrackerDB schema", () => {
  it("creates all 15 tables", () => {
    const tableNames = testDb.tables.map((t) => t.name).sort();
    expect(tableNames).toEqual([
      "exerciseProgress",
      "exerciseSubstitutions",
      "exercises",
      "phaseWorkoutExercises",
      "phaseWorkoutSections",
      "phaseWorkouts",
      "programPhases",
      "programRoutines",
      "programs",
      "templateExercises",
      "userPrograms",
      "users",
      "workoutSessions",
      "workoutSets",
      "workoutTemplates",
    ]);
  });

  it("can add and retrieve a user record", async () => {
    const user: DbUser = {
      id: "user-1",
      email: "test@example.com",
      display_name: "Test User",
      preferred_unit: "kg",
      created_at: "2024-01-01T00:00:00Z",
      sync_status: "synced",
    };

    await testDb.users.add(user);
    const retrieved = await testDb.users.get("user-1");
    expect(retrieved).toEqual(user);
  });

  it("can add and retrieve an exercise record", async () => {
    const exercise: DbExercise = {
      id: "ex-1",
      user_id: null,
      name: "Bench Press",
      muscle_group: "Chest",
      equipment: "Barbell",
      is_custom: false,
      exercise_type: "reps",
      youtube_url: null,
      notes: null,
      created_at: "2024-01-01T00:00:00Z",
      sync_status: "synced",
    };

    await testDb.exercises.add(exercise);
    const retrieved = await testDb.exercises.get("ex-1");
    expect(retrieved).toEqual(exercise);
  });

  it("can add and retrieve an exercise substitution", async () => {
    const sub: DbExerciseSubstitution = {
      id: "sub-1",
      exercise_id: "ex-1",
      substitute_exercise_id: "ex-2",
      priority: 1,
      sync_status: "pending",
    };

    await testDb.exerciseSubstitutions.add(sub);
    const retrieved = await testDb.exerciseSubstitutions.get("sub-1");
    expect(retrieved).toEqual(sub);
  });

  it("can add and retrieve a workout template", async () => {
    const template: DbWorkoutTemplate = {
      id: "tpl-1",
      user_id: "user-1",
      name: "Push Day",
      created_at: "2024-01-01T00:00:00Z",
      sync_status: "pending",
    };

    await testDb.workoutTemplates.add(template);
    const retrieved = await testDb.workoutTemplates.get("tpl-1");
    expect(retrieved).toEqual(template);
  });

  it("can add and retrieve a template exercise", async () => {
    const te: DbTemplateExercise = {
      id: "te-1",
      template_id: "tpl-1",
      exercise_id: "ex-1",
      week_type: "normal",
      order: 0,
      working_sets: 3,
      min_reps: 6,
      max_reps: 10,
      early_set_rpe_min: 7,
      early_set_rpe_max: 8,
      last_set_rpe_min: 9,
      last_set_rpe_max: 10,
      rest_period: "2-3 mins",
      intensity_technique: null,
      warmup_sets: 2,
      parent_exercise_id: null,
      sync_status: "synced",
    };

    await testDb.templateExercises.add(te);
    const retrieved = await testDb.templateExercises.get("te-1");
    expect(retrieved).toEqual(te);
  });

  it("can add and retrieve a workout session", async () => {
    const session: DbWorkoutSession = {
      id: "sess-1",
      user_id: "user-1",
      template_id: "tpl-1",
      year_week: "2024-W01",
      week_type: "normal",
      started_at: "2024-01-01T10:00:00Z",
      finished_at: null,
      notes: null,
      program_id: null,
      phase_workout_id: null,
      user_program_id: null,
      sync_status: "pending",
    };

    await testDb.workoutSessions.add(session);
    const retrieved = await testDb.workoutSessions.get("sess-1");
    expect(retrieved).toEqual(session);
  });

  it("can add and retrieve a workout session with program_id", async () => {
    const session: DbWorkoutSession = {
      id: "sess-2",
      user_id: "user-1",
      template_id: "tpl-1",
      year_week: "2024-W01",
      week_type: "normal",
      started_at: "2024-01-01T10:00:00Z",
      finished_at: null,
      notes: null,
      program_id: "prog-1",
      phase_workout_id: null,
      user_program_id: "up-1",
      sync_status: "pending",
    };

    await testDb.workoutSessions.add(session);
    const retrieved = await testDb.workoutSessions.get("sess-2");
    expect(retrieved).toEqual(session);
    expect(retrieved?.program_id).toBe("prog-1");
    expect(retrieved?.user_program_id).toBe("up-1");
  });

  it("can add and retrieve a program", async () => {
    const program: DbProgram = {
      id: "prog-1",
      user_id: "user-1",
      name: "Push Pull Legs",
      program_type: "rotating",
      deload_every_n_weeks: 6,
      created_at: "2024-01-01T00:00:00Z",
      sync_status: "pending",
    };

    await testDb.programs.add(program);
    const retrieved = await testDb.programs.get("prog-1");
    expect(retrieved).toEqual(program);
  });

  it("can add and retrieve a shared program (null user_id)", async () => {
    const program: DbProgram = {
      id: "prog-shared",
      user_id: null,
      name: "Shared Program",
      program_type: "phased",
      deload_every_n_weeks: 4,
      created_at: "2024-01-01T00:00:00Z",
      sync_status: "synced",
    };

    await testDb.programs.add(program);
    const retrieved = await testDb.programs.get("prog-shared");
    expect(retrieved).toEqual(program);
    expect(retrieved?.user_id).toBeNull();
  });

  it("can add and retrieve a user program enrollment", async () => {
    const enrollment: DbUserProgram = {
      id: "up-1",
      user_id: "user-1",
      program_id: "prog-1",
      is_active: true,
      started_at: "2024-01-01T00:00:00Z",
      current_routine_index: 2,
      current_phase_index: 0,
      current_week_in_phase: 1,
      current_day_index: 0,
      weeks_completed: 3,
      last_workout_at: "2024-01-15T10:00:00Z",
      created_at: "2024-01-01T00:00:00Z",
      sync_status: "pending",
    };

    await testDb.userPrograms.add(enrollment);
    const retrieved = await testDb.userPrograms.get("up-1");
    expect(retrieved).toEqual(enrollment);
  });

  it("can add and retrieve a program routine", async () => {
    const routine: DbProgramRoutine = {
      id: "pr-1",
      program_id: "prog-1",
      template_id: "tpl-1",
      order: 0,
      sync_status: "pending",
    };

    await testDb.programRoutines.add(routine);
    const retrieved = await testDb.programRoutines.get("pr-1");
    expect(retrieved).toEqual(routine);
  });

  it("can add and retrieve a workout set", async () => {
    const set: DbWorkoutSet = {
      id: "set-1",
      session_id: "sess-1",
      exercise_id: "ex-1",
      set_type: "working",
      set_number: 1,
      reps: 8,
      weight: 100,
      rpe: 8.5,
      notes: null,
      created_at: "2024-01-01T10:05:00Z",
      sync_status: "synced",
    };

    await testDb.workoutSets.add(set);
    const retrieved = await testDb.workoutSets.get("set-1");
    expect(retrieved).toEqual(set);
  });

  it("can add and retrieve an exercise progress record", async () => {
    const progress: DbExerciseProgress = {
      id: "prog-1",
      user_id: "user-1",
      exercise_id: "ex-1",
      year_week: "2024-W01",
      max_weight: 100,
      created_at: "2024-01-01T10:30:00Z",
      sync_status: "synced",
    };

    await testDb.exerciseProgress.add(progress);
    const retrieved = await testDb.exerciseProgress.get("prog-1");
    expect(retrieved).toEqual(progress);
  });

  it("sync_status field filters correctly", async () => {
    await testDb.exercises.bulkAdd([
      {
        id: "ex-1",
        user_id: null,
        name: "Bench Press",
        muscle_group: "Chest",
        equipment: "Barbell",
        is_custom: false,
        exercise_type: "reps",
        youtube_url: null,
        notes: null,
        created_at: "2024-01-01T00:00:00Z",
        sync_status: "pending",
      },
      {
        id: "ex-2",
        user_id: null,
        name: "Squat",
        muscle_group: "Legs",
        equipment: "Barbell",
        is_custom: false,
        exercise_type: "reps",
        youtube_url: null,
        notes: null,
        created_at: "2024-01-01T00:00:00Z",
        sync_status: "synced",
      },
      {
        id: "ex-3",
        user_id: null,
        name: "Deadlift",
        muscle_group: "Back",
        equipment: "Barbell",
        is_custom: false,
        exercise_type: "reps",
        youtube_url: null,
        notes: null,
        created_at: "2024-01-01T00:00:00Z",
        sync_status: "pending",
      },
    ]);

    const pending = await testDb.exercises
      .where("sync_status")
      .equals(SYNC_STATUS.pending)
      .toArray();

    expect(pending).toHaveLength(2);
    expect(pending.map((e) => e.name).sort()).toEqual([
      "Bench Press",
      "Deadlift",
    ]);

    const synced = await testDb.exercises
      .where("sync_status")
      .equals(SYNC_STATUS.synced)
      .toArray();

    expect(synced).toHaveLength(1);
    expect(synced[0].name).toBe("Squat");
  });
});
