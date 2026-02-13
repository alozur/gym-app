import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
import type { DbProgram, DbProgramRoutine } from "@/db/schema";
import Programs from "@/pages/Programs";

const samplePrograms: DbProgram[] = [
  {
    id: "prog-1",
    user_id: "u1",
    name: "Push Pull Legs",
    deload_every_n_weeks: 6,
    is_active: true,
    started_at: "2024-01-01T00:00:00Z",
    current_routine_index: 0,
    weeks_completed: 2,
    last_workout_at: null,
    created_at: "2024-01-01T00:00:00Z",
    sync_status: "synced",
  },
  {
    id: "prog-2",
    user_id: "u1",
    name: "Upper Lower",
    deload_every_n_weeks: 4,
    is_active: false,
    started_at: null,
    current_routine_index: 0,
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

function renderPrograms() {
  return render(
    <MemoryRouter>
      <Programs />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete();
  await db.open();
});

describe("Programs", () => {
  it("renders empty state when no programs exist", async () => {
    renderPrograms();

    await waitFor(() => {
      expect(screen.getByText("No programs yet")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /create program/i }),
    ).toBeInTheDocument();
  });

  it("renders program names when programs exist", async () => {
    await db.programs.bulkAdd(samplePrograms);
    await db.programRoutines.bulkAdd(sampleRoutines);

    renderPrograms();

    await waitFor(() => {
      expect(screen.getByText("Push Pull Legs")).toBeInTheDocument();
    });

    expect(screen.getByText("Upper Lower")).toBeInTheDocument();
  });

  it("shows Active badge for active program", async () => {
    await db.programs.bulkAdd(samplePrograms);
    await db.programRoutines.bulkAdd(sampleRoutines);

    renderPrograms();

    await waitFor(() => {
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });

  it("shows routine count badge", async () => {
    await db.programs.bulkAdd(samplePrograms);
    await db.programRoutines.bulkAdd(sampleRoutines);

    renderPrograms();

    await waitFor(() => {
      expect(screen.getByText("3 routines")).toBeInTheDocument();
    });

    expect(screen.getByText("0 routines")).toBeInTheDocument();
  });

  it("shows Create Program button", async () => {
    renderPrograms();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create program/i }),
      ).toBeInTheDocument();
    });
  });
});
