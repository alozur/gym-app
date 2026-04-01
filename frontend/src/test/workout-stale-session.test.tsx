import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const mockNavigate = vi.fn();

vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error("offline")),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  ApiError: class ApiError extends Error {
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
      isAuthenticated: true,
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
import type { DbWorkoutSession, DbWorkoutSet } from "@/db/schema";
import Workout from "@/pages/Workout";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const NOW = new Date("2024-06-01T12:00:00.000Z").getTime();
const staleStartedAt = new Date(NOW - TWO_HOURS_MS - 1000).toISOString();
const recentStartedAt = new Date(NOW - 30 * 60 * 1000).toISOString();

function makeSession(
  overrides: Partial<DbWorkoutSession> = {},
): DbWorkoutSession {
  return {
    id: "sess-1",
    user_id: "u1",
    template_id: null,
    year_week: "2024-W22",
    week_type: "normal",
    started_at: staleStartedAt,
    finished_at: null,
    notes: null,
    program_id: null,
    phase_workout_id: null,
    user_program_id: null,
    sync_status: "pending",
    ...overrides,
  };
}

function makeSet(overrides: Partial<DbWorkoutSet> = {}): DbWorkoutSet {
  return {
    id: "set-1",
    session_id: "sess-1",
    exercise_id: "ex-1",
    set_type: "working",
    set_number: 1,
    reps: 8,
    weight: 80,
    rpe: null,
    notes: null,
    created_at: staleStartedAt,
    sync_status: "pending",
    ...overrides,
  };
}

function renderWorkout() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/workout", state: null }]}>
      <Workout />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.setSystemTime(NOW);
  await db.delete();
  await db.open();
});

afterEach(async () => {
  vi.useRealTimers();
  cleanup();
  await new Promise((r) => setTimeout(r, 50));
});

describe("Stale session detection", () => {
  it("shows the stale dialog when the unfinished session is older than 2 hours", async () => {
    await db.workoutSessions.add(makeSession({ started_at: staleStartedAt }));

    renderWorkout();

    await waitFor(() => {
      expect(screen.getByText("Unfinished workout")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
  });

  it("does not show the stale dialog when the session is under 2 hours old", async () => {
    await db.workoutSessions.add(makeSession({ started_at: recentStartedAt }));

    renderWorkout();

    await waitFor(() => {
      expect(screen.queryByText("Unfinished workout")).not.toBeInTheDocument();
    });
  });

  it("includes the template name in the stale dialog when the session has a template", async () => {
    await db.workoutTemplates.add({
      id: "tpl-1",
      user_id: "u1",
      name: "Push Day",
      created_at: "2024-01-01T00:00:00Z",
      sync_status: "synced",
    });
    await db.workoutSessions.add(
      makeSession({ template_id: "tpl-1", started_at: staleStartedAt }),
    );

    renderWorkout();

    await waitFor(() => {
      expect(screen.getByText("Unfinished workout")).toBeInTheDocument();
    });

    expect(screen.getByText(/Push Day/)).toBeInTheDocument();
  });
});

describe("Recent session auto-resume", () => {
  it("sets session state directly without showing the stale dialog", async () => {
    await db.workoutSessions.add(makeSession({ started_at: recentStartedAt }));

    renderWorkout();

    await waitFor(() => {
      expect(screen.queryByText("Unfinished workout")).not.toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: "Resume" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Discard" }),
    ).not.toBeInTheDocument();
  });
});

describe("handleDiscardStale", () => {
  it("deletes workout sets by session_id, deletes the session, and closes the dialog", async () => {
    const session = makeSession({ started_at: staleStartedAt });
    await db.workoutSessions.add(session);
    await db.workoutSets.add(makeSet({ session_id: session.id }));
    await db.workoutSets.add(
      makeSet({ id: "set-2", session_id: session.id, set_number: 2 }),
    );

    renderWorkout();

    await waitFor(() => {
      expect(screen.getByText("Unfinished workout")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => {
      expect(screen.queryByText("Unfinished workout")).not.toBeInTheDocument();
    });

    const remainingSessions = await db.workoutSessions.toArray();
    expect(remainingSessions).toHaveLength(0);

    const remainingSets = await db.workoutSets.toArray();
    expect(remainingSets).toHaveLength(0);
  });

  it("only deletes sets belonging to the stale session", async () => {
    const staleSession = makeSession({
      id: "sess-stale",
      started_at: staleStartedAt,
    });
    const otherSession = makeSession({
      id: "sess-other",
      started_at: staleStartedAt,
      finished_at: new Date(NOW - 1000).toISOString(),
    });
    await db.workoutSessions.bulkAdd([staleSession, otherSession]);
    await db.workoutSets.add(makeSet({ session_id: "sess-stale" }));
    await db.workoutSets.add(
      makeSet({ id: "set-other", session_id: "sess-other" }),
    );

    renderWorkout();

    await waitFor(() => {
      expect(screen.getByText("Unfinished workout")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => {
      expect(screen.queryByText("Unfinished workout")).not.toBeInTheDocument();
    });

    const remainingSets = await db.workoutSets.toArray();
    expect(remainingSets).toHaveLength(1);
    expect(remainingSets[0].session_id).toBe("sess-other");
  });
});

describe("handleResumeStale", () => {
  it("moves the stale session into active session state and closes the dialog", async () => {
    await db.workoutSessions.add(makeSession({ started_at: staleStartedAt }));

    renderWorkout();

    await waitFor(() => {
      expect(screen.getByText("Unfinished workout")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Resume" }));

    await waitFor(() => {
      expect(screen.queryByText("Unfinished workout")).not.toBeInTheDocument();
    });

    const sessionInDb = await db.workoutSessions.get("sess-1");
    expect(sessionInDb).toBeDefined();
    expect(sessionInDb?.finished_at).toBeNull();
  });

  it("does not delete the session or its sets when resuming", async () => {
    await db.workoutSessions.add(makeSession({ started_at: staleStartedAt }));
    await db.workoutSets.add(makeSet());

    renderWorkout();

    await waitFor(() => {
      expect(screen.getByText("Unfinished workout")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "Resume" }));

    await waitFor(() => {
      expect(screen.queryByText("Unfinished workout")).not.toBeInTheDocument();
    });

    const sessions = await db.workoutSessions.toArray();
    expect(sessions).toHaveLength(1);

    const sets = await db.workoutSets.toArray();
    expect(sets).toHaveLength(1);
  });
});
