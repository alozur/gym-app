import { GymTrackerDB } from "./schema.ts";

export const db = new GymTrackerDB();

export { SYNC_STATUS } from "./schema.ts";
export type {
  SyncStatus,
  DbUser,
  DbExercise,
  DbExerciseSubstitution,
  DbWorkoutTemplate,
  DbTemplateExercise,
  DbWorkoutSession,
  DbWorkoutSet,
  DbExerciseProgress,
  DbProgram,
  DbUserProgram,
  DbProgramRoutine,
  DbProgramPhase,
  DbPhaseWorkout,
  DbPhaseWorkoutSection,
  DbPhaseWorkoutExercise,
} from "./schema.ts";
export { GymTrackerDB } from "./schema.ts";
