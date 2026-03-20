import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

// Track navigate calls
const mockNavigate = vi.fn();

vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error("offline")),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  getAccessToken: vi.fn(() => null),
  getRefreshToken: vi.fn(() => null),
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  ApiError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "ApiError";
    }
  },
}));

vi.mock("@/db/index", async () => {
  const { GymTrackerDB, SYNC_STATUS } = await import("@/db/schema");
  const instance = new GymTrackerDB();
  return {
    db: instance,
    SYNC_STATUS,
    GymTrackerDB,
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuthContext: () => ({
    state: {
      user: {
        id: "u1",
        email: "test@example.com",
        display_name: "Test User",
        preferred_unit: "kg",
        created_at: "2024-01-01T00:00:00Z",
      },
      accessToken: "token",
      refreshToken: "refresh",
      isAuthenticated: false,
      isLoading: false,
    },
    dispatch: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { db } from "@/db/index";
import type {
  DbProgram,
  DbUserProgram,
  DbProgramRoutine,
  DbWorkoutTemplate,
  DbTemplateExercise,
} from "@/db/schema";
import Workout from "@/pages/Workout";

const program: DbProgram = {
  id: "prog-1",
  user_id: "u1",
  name: "PPL",
  program_type: "rotating",
  deload_every_n_weeks: 4,
  created_at: "2024-01-01T00:00:00Z",
  sync_status: "synced",
};

const enrollment: DbUserProgram = {
  id: "up-1",
  user_id: "u1",
  program_id: "prog-1",
  is_active: true,
  started_at: "2024-01-01T00:00:00Z",
  current_routine_index: 0,
  current_phase_index: 0,
  current_week_in_phase: 0,
  current_day_index: 0,
  weeks_completed: 0,
  last_workout_at: null,
  created_at: "2024-01-01T00:00:00Z",
  sync_status: "synced",
};

const templates: DbWorkoutTemplate[] = [
  {
    id: "tpl-1",
    user_id: "u1",
    name: "Push Day",
    created_at: "2024-01-01T00:00:00Z",
    sync_status: "synced",
  },
  {
    id: "tpl-2",
    user_id: "u1",
    name: "Pull Day",
    created_at: "2024-01-01T00:00:00Z",
    sync_status: "synced",
  },
];

const routines: DbProgramRoutine[] = [
  {
    id: "pr-1",
    program_id: "prog-1",
    template_id: "tpl-1",
    order: 0,
    sync_status: "synced",
  },
  {
    id: "pr-2",
    program_id: "prog-1",
    template_id: "tpl-2",
    order: 1,
    sync_status: "synced",
  },
];

const templateExercises: DbTemplateExercise[] = [
  {
    id: "te-1",
    template_id: "tpl-1",
    exercise_id: "ex-1",
    week_type: "normal",
    order: 0,
    working_sets: 3,
    min_reps: 8,
    max_reps: 12,
    early_set_rpe_min: 7,
    early_set_rpe_max: 8,
    last_set_rpe_min: 8,
    last_set_rpe_max: 9,
    rest_period: "2 min",
    intensity_technique: null,
    warmup_sets: 0,
    parent_exercise_id: null,
    sync_status: "synced",
  },
  {
    id: "te-2",
    template_id: "tpl-2",
    exercise_id: "ex-1",
    week_type: "normal",
    order: 0,
    working_sets: 3,
    min_reps: 8,
    max_reps: 12,
    early_set_rpe_min: 7,
    early_set_rpe_max: 8,
    last_set_rpe_min: 8,
    last_set_rpe_max: 9,
    rest_period: "2 min",
    intensity_technique: null,
    warmup_sets: 0,
    parent_exercise_id: null,
    sync_status: "synced",
  },
];

function renderWorkout(locationState?: Record<string, unknown>) {
  const entries = [
    {
      pathname: "/workout",
      state: locationState ?? null,
    },
  ];
  return render(
    <MemoryRouter initialEntries={entries}>
      <Workout />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete();
  await db.open();
});

afterEach(async () => {
  cleanup();
  // Allow pending async effects to settle before db is torn down
  await new Promise((r) => setTimeout(r, 50));
});

describe("Workout overrides from Programs page", () => {
  it("shows TodayScreen with default routine when no overrides", async () => {
    await db.programs.add(program);
    await db.userPrograms.add(enrollment);
    await db.programRoutines.bulkAdd(routines);
    await db.workoutTemplates.bulkAdd(templates);
    await db.templateExercises.bulkAdd(templateExercises);

    renderWorkout();

    // TodayScreen should show the program name and routine selection
    await waitFor(() => {
      expect(screen.getByText("PPL")).toBeInTheDocument();
    });

    // Default: routine index 0 = "Push Day" should be auto-selected
    expect(screen.getByText("Push Day")).toBeInTheDocument();
  });

  it("pre-selects overridden routine when navigated with state", async () => {
    await db.programs.add(program);
    await db.userPrograms.add(enrollment);
    await db.programRoutines.bulkAdd(routines);
    await db.workoutTemplates.bulkAdd(templates);
    await db.templateExercises.bulkAdd(templateExercises);

    // Navigate with override to select routine index 1 (Pull Day)
    renderWorkout({ overrideRoutineIndex: 1 });

    await waitFor(() => {
      expect(screen.getByText("PPL")).toBeInTheDocument();
    });

    // Both routines should be visible (Pull Day appears in selector + detail card)
    expect(screen.getByText("Push Day")).toBeInTheDocument();
    expect(screen.getAllByText("Pull Day").length).toBeGreaterThanOrEqual(1);
  });

  it("clears location state after reading overrides", async () => {
    await db.programs.add(program);
    await db.userPrograms.add(enrollment);
    await db.programRoutines.bulkAdd(routines);
    await db.workoutTemplates.bulkAdd(templates);
    await db.templateExercises.bulkAdd(templateExercises);

    renderWorkout({ overrideRoutineIndex: 1 });

    await waitFor(() => {
      expect(screen.getByText("PPL")).toBeInTheDocument();
    });

    // navigate should have been called with replace to clear state
    expect(mockNavigate).toHaveBeenCalledWith("/workout", {
      replace: true,
      state: null,
    });
  });

  it("shows No Active Program when user has no enrollment", async () => {
    renderWorkout();

    await waitFor(() => {
      expect(screen.getByText("No Active Program")).toBeInTheDocument();
    });
  });

  it("does not clear location state when no state was passed", async () => {
    renderWorkout();

    await waitFor(() => {
      expect(screen.getByText("No Active Program")).toBeInTheDocument();
    });

    // navigate should NOT have been called to clear state
    expect(mockNavigate).not.toHaveBeenCalledWith("/workout", {
      replace: true,
      state: null,
    });
  });
});
