import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

// Mock api client
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

// Mock db/index
vi.mock("@/db/index", async () => {
  const { GymTrackerDB, SYNC_STATUS } = await import("@/db/schema");
  const instance = new GymTrackerDB();
  return {
    db: instance,
    SYNC_STATUS,
    GymTrackerDB,
  };
});

// Mock AuthContext
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

// Mock useNavigate
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

import { db } from "@/db/index";
import type {
  DbProgram,
  DbProgramRoutine,
  DbUserProgram,
  DbWorkoutTemplate,
} from "@/db/schema";
import Programs from "@/pages/Programs";

const samplePrograms: DbProgram[] = [
  {
    id: "prog-1",
    user_id: "u1",
    name: "Push Pull Legs",
    program_type: "rotating",
    deload_every_n_weeks: 6,
    created_at: "2024-01-01T00:00:00Z",
    sync_status: "synced",
  },
  {
    id: "prog-2",
    user_id: "u1",
    name: "Upper Lower",
    program_type: "rotating",
    deload_every_n_weeks: 4,
    created_at: "2024-01-02T00:00:00Z",
    sync_status: "synced",
  },
];

const sampleEnrollments: DbUserProgram[] = [
  {
    id: "up-1",
    user_id: "u1",
    program_id: "prog-1",
    is_active: true,
    started_at: "2024-01-01T00:00:00Z",
    current_routine_index: 0,
    current_phase_index: 0,
    current_week_in_phase: 0,
    current_day_index: 0,
    weeks_completed: 2,
    last_workout_at: null,
    created_at: "2024-01-01T00:00:00Z",
    sync_status: "synced",
  },
  {
    id: "up-2",
    user_id: "u1",
    program_id: "prog-2",
    is_active: false,
    started_at: null,
    current_routine_index: 0,
    current_phase_index: 0,
    current_week_in_phase: 0,
    current_day_index: 0,
    weeks_completed: 0,
    last_workout_at: null,
    created_at: "2024-01-02T00:00:00Z",
    sync_status: "synced",
  },
];

const sampleRoutines: DbProgramRoutine[] = [
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
  {
    id: "pr-3",
    program_id: "prog-1",
    template_id: "tpl-3",
    order: 2,
    sync_status: "synced",
  },
];

const sampleTemplates: DbWorkoutTemplate[] = [
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
  {
    id: "tpl-3",
    user_id: "u1",
    name: "Leg Day",
    created_at: "2024-01-01T00:00:00Z",
    sync_status: "synced",
  },
];

function renderPrograms() {
  return render(
    <MemoryRouter>
      <Programs />
    </MemoryRouter>,
  );
}

afterEach(async () => {
  cleanup();
  await new Promise((r) => setTimeout(r, 50));
});

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete();
  await db.open();
});

describe("Programs", () => {
  it("renders no active program state when no programs exist", async () => {
    renderPrograms();

    await waitFor(() => {
      expect(screen.getByText("No Active Program")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Browse Library" }),
    ).toBeInTheDocument();
  });

  it("renders active program name when programs exist", async () => {
    await db.programs.bulkAdd(samplePrograms);
    await db.userPrograms.bulkAdd(sampleEnrollments);
    await db.programRoutines.bulkAdd(sampleRoutines);

    renderPrograms();

    await waitFor(() => {
      expect(screen.getByText("Push Pull Legs")).toBeInTheDocument();
    });
  });

  it("shows Unenroll button for active program", async () => {
    await db.programs.bulkAdd(samplePrograms);
    await db.userPrograms.bulkAdd(sampleEnrollments);
    await db.programRoutines.bulkAdd(sampleRoutines);

    renderPrograms();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /unenroll/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows Go to Workout button", async () => {
    await db.programs.bulkAdd(samplePrograms);
    await db.userPrograms.bulkAdd(sampleEnrollments);
    await db.programRoutines.bulkAdd(sampleRoutines);
    await db.workoutTemplates.bulkAdd(sampleTemplates);

    renderPrograms();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /go to workout/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows Create and Library buttons", async () => {
    renderPrograms();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Create" }),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Library" })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Library Dialog Tests
  // -------------------------------------------------------------------------

  it("opens library dialog when Library button is clicked", async () => {
    const user = userEvent.setup();
    renderPrograms();

    // Wait for initial load
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Library" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Library" }));

    await waitFor(() => {
      expect(screen.getByText("Program Library")).toBeInTheDocument();
    });
  });

  it("shows program details in library dialog", async () => {
    await db.programs.bulkAdd(samplePrograms);
    await db.userPrograms.bulkAdd(sampleEnrollments);

    const user = userEvent.setup();
    renderPrograms();

    // Wait for initial load
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Library" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Library" }));

    await waitFor(() => {
      expect(screen.getByText("Program Library")).toBeInTheDocument();
    });

    // Both program names should appear (Push Pull Legs also appears in the
    // active-program heading behind the dialog, so use getAllByText)
    expect(screen.getAllByText("Push Pull Legs").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByText("Upper Lower")).toBeInTheDocument();

    // Should show Activate/Deactivate buttons and Edit/View and Delete buttons
    // prog-1 is active so it shows "Deactivate"; prog-2 is inactive so "Activate"
    expect(
      screen.getByRole("button", { name: "Deactivate" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Activate" }),
    ).toBeInTheDocument();
    // Both programs are user-owned and rotating, so buttons should read "Edit"
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
    // Delete buttons
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // Week Navigation Tests
  // -------------------------------------------------------------------------

  it("shows week navigation for active rotating program", async () => {
    // Use a program with deload_every_n_weeks=4 so we get "Week 1 of 4"
    const programs: DbProgram[] = [
      {
        id: "prog-3",
        user_id: "u1",
        name: "My 4-Week Program",
        program_type: "rotating",
        deload_every_n_weeks: 4,
        created_at: "2024-01-01T00:00:00Z",
        sync_status: "synced",
      },
    ];
    const enrollments: DbUserProgram[] = [
      {
        id: "up-3",
        user_id: "u1",
        program_id: "prog-3",
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
      },
    ];
    const routines: DbProgramRoutine[] = [
      {
        id: "pr-a",
        program_id: "prog-3",
        template_id: "tpl-1",
        order: 0,
        sync_status: "synced",
      },
    ];

    await db.programs.bulkAdd(programs);
    await db.userPrograms.bulkAdd(enrollments);
    await db.programRoutines.bulkAdd(routines);
    await db.workoutTemplates.bulkAdd(sampleTemplates);

    renderPrograms();

    await waitFor(() => {
      expect(screen.getByText("Week 1 of 4")).toBeInTheDocument();
    });
  });

  it("navigates to next week when right arrow is clicked", async () => {
    const programs: DbProgram[] = [
      {
        id: "prog-4",
        user_id: "u1",
        name: "Navigation Test Program",
        program_type: "rotating",
        deload_every_n_weeks: 4,
        created_at: "2024-01-01T00:00:00Z",
        sync_status: "synced",
      },
    ];
    const enrollments: DbUserProgram[] = [
      {
        id: "up-4",
        user_id: "u1",
        program_id: "prog-4",
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
      },
    ];
    const routines: DbProgramRoutine[] = [
      {
        id: "pr-b",
        program_id: "prog-4",
        template_id: "tpl-1",
        order: 0,
        sync_status: "synced",
      },
    ];

    await db.programs.bulkAdd(programs);
    await db.userPrograms.bulkAdd(enrollments);
    await db.programRoutines.bulkAdd(routines);
    await db.workoutTemplates.bulkAdd(sampleTemplates);

    const user = userEvent.setup();
    renderPrograms();

    // Wait for "Week 1 of 4" to appear
    await waitFor(() => {
      expect(screen.getByText("Week 1 of 4")).toBeInTheDocument();
    });

    // Find the right chevron button (the one that goes forward)
    // It's the second button in the week navigation row
    // The right chevron is the enabled navigation button with an svg icon.
    // Left chevron is disabled (currentWeekIndex=0), right chevron is enabled.
    const rightChevron = screen
      .getAllByRole("button")
      .find(
        (btn) =>
          !(btn as HTMLButtonElement).disabled &&
          btn.className.includes("p-2") &&
          btn.getAttribute("type") === "button" &&
          btn.querySelector("svg"),
      );

    expect(rightChevron).toBeDefined();
    await user.click(rightChevron!);

    await waitFor(() => {
      expect(screen.getByText("Week 2 of 4")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Workout Grid Tests
  // -------------------------------------------------------------------------

  it("shows workout cards in grid for active rotating program", async () => {
    await db.programs.bulkAdd(samplePrograms);
    await db.userPrograms.bulkAdd(sampleEnrollments);
    await db.programRoutines.bulkAdd(sampleRoutines);
    await db.workoutTemplates.bulkAdd(sampleTemplates);

    renderPrograms();

    await waitFor(() => {
      expect(screen.getByText("Push Day")).toBeInTheDocument();
    });

    expect(screen.getByText("Pull Day")).toBeInTheDocument();
    expect(screen.getByText("Leg Day")).toBeInTheDocument();
  });

  it("marks completed workouts with Done indicator", async () => {
    // current_routine_index=1 means routine at index 0 (Push Day) is completed
    const enrollmentWithCompleted: DbUserProgram[] = [
      {
        id: "up-5",
        user_id: "u1",
        program_id: "prog-1",
        is_active: true,
        started_at: "2024-01-01T00:00:00Z",
        current_routine_index: 1,
        current_phase_index: 0,
        current_week_in_phase: 0,
        current_day_index: 0,
        weeks_completed: 2,
        last_workout_at: null,
        created_at: "2024-01-01T00:00:00Z",
        sync_status: "synced",
      },
    ];

    await db.programs.bulkAdd([samplePrograms[0]]);
    await db.userPrograms.bulkAdd(enrollmentWithCompleted);
    await db.programRoutines.bulkAdd(sampleRoutines);
    await db.workoutTemplates.bulkAdd(sampleTemplates);

    renderPrograms();

    // Wait for the workout grid to render
    await waitFor(() => {
      expect(screen.getByText("Push Day")).toBeInTheDocument();
    });

    // Push Day (index 0) should be marked as Done since current_routine_index=1
    expect(screen.getByText("Done")).toBeInTheDocument();
  });
});
