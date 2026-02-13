import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getAccessToken: vi.fn(() => null),
  getRefreshToken: vi.fn(() => null),
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
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
      isAuthenticated: true,
      isLoading: false,
    },
    dispatch: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  BarChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

import { db } from "@/db/index";
import type {
  DbExercise,
  DbExerciseProgress,
  DbWorkoutSession,
  DbWorkoutSet,
} from "@/db/schema";
import Dashboard from "@/pages/Dashboard";

const sampleExercises: DbExercise[] = [
  {
    id: "ex-1",
    user_id: null,
    name: "Bench Press",
    muscle_group: "Chest",
    equipment: "Barbell",
    is_custom: false,
    youtube_url: null,
    notes: null,
    created_at: "2024-01-01T00:00:00Z",
    sync_status: "synced",
  },
  {
    id: "ex-2",
    user_id: null,
    name: "Squat",
    muscle_group: "Legs",
    equipment: "Barbell",
    is_custom: false,
    youtube_url: null,
    notes: null,
    created_at: "2024-01-01T00:00:00Z",
    sync_status: "synced",
  },
];

const sampleProgress: DbExerciseProgress[] = [
  {
    id: "prog-1",
    user_id: "u1",
    exercise_id: "ex-1",
    year_week: "2024-01",
    max_weight: 80,
    warmup_weight_range: "40-60",
    warmup_sets_done: 2,
    created_at: "2024-01-01T00:00:00Z",
    sync_status: "synced",
  },
  {
    id: "prog-2",
    user_id: "u1",
    exercise_id: "ex-1",
    year_week: "2024-02",
    max_weight: 85,
    warmup_weight_range: "40-60",
    warmup_sets_done: 2,
    created_at: "2024-01-08T00:00:00Z",
    sync_status: "synced",
  },
];

const sampleSessions: DbWorkoutSession[] = [
  {
    id: "sess-1",
    user_id: "u1",
    template_id: null,
    year_week: "2024-01",
    week_type: "normal",
    started_at: "2024-01-01T10:00:00Z",
    finished_at: "2024-01-01T11:00:00Z",
    notes: null,
    sync_status: "synced",
  },
];

const sampleSets: DbWorkoutSet[] = [
  {
    id: "set-1",
    session_id: "sess-1",
    exercise_id: "ex-1",
    set_type: "working",
    set_number: 1,
    reps: 8,
    weight: 80,
    rpe: 8,
    notes: null,
    created_at: "2024-01-01T10:15:00Z",
    sync_status: "synced",
  },
];

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.exercises.bulkAdd(sampleExercises);
  await db.exerciseProgress.bulkAdd(sampleProgress);
  await db.workoutSessions.bulkAdd(sampleSessions);
  await db.workoutSets.bulkAdd(sampleSets);
});

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Dashboard />
    </MemoryRouter>,
  );
}

describe("Dashboard", () => {
  it("renders all four tab buttons", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Progress" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Volume" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Records" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
  });

  it("defaults to Progress tab with exercise selector", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Weight Progression")).toBeInTheDocument();
    });
  });

  it("switches to Volume tab", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Volume" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Volume" }));

    await waitFor(() => {
      expect(screen.getByText("Volume by Muscle Group")).toBeInTheDocument();
    });
  });

  it("switches to Records tab and shows personal records", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Records" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Records" }));

    await waitFor(() => {
      expect(screen.getByText("Personal Records")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
      expect(screen.getByText("85 kg")).toBeInTheDocument();
    });
  });

  it("switches to History tab and shows past sessions", async () => {
    const user = userEvent.setup();
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "History" }));

    await waitFor(() => {
      expect(screen.getByText("Workout History")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("Ad-hoc")).toBeInTheDocument();
      expect(screen.getByText("1 sets")).toBeInTheDocument();
    });
  });
});
