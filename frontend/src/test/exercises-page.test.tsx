import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const mockNavigate = vi.fn();

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

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import { db } from "@/db/index";
import type { DbExercise, DbExerciseSubstitution } from "@/db/schema";
import Exercises from "@/pages/Exercises";

const sampleExercises: DbExercise[] = [
  {
    id: "ex-1",
    user_id: null,
    name: "Bench Press",
    muscle_group: "Chest",
    equipment: "Barbell",
    is_custom: false,
    youtube_url: "https://youtube.com/bench",
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
  {
    id: "ex-3",
    user_id: null,
    name: "Overhead Press",
    muscle_group: "Shoulders",
    equipment: "Barbell",
    is_custom: false,
    youtube_url: null,
    notes: null,
    created_at: "2024-01-01T00:00:00Z",
    sync_status: "synced",
  },
  {
    id: "ex-4",
    user_id: null,
    name: "Incline Dumbbell Press",
    muscle_group: "Chest",
    equipment: "Dumbbell",
    is_custom: false,
    youtube_url: null,
    notes: null,
    created_at: "2024-01-01T00:00:00Z",
    sync_status: "synced",
  },
];

const sampleSubstitutions: DbExerciseSubstitution[] = [
  {
    id: "sub-1",
    exercise_id: "ex-1",
    substitute_exercise_id: "ex-4",
    priority: 1,
    sync_status: "synced",
  },
];

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete();
  await db.open();
  await db.exercises.bulkAdd(sampleExercises);
  await db.exerciseSubstitutions.bulkAdd(sampleSubstitutions);
});

function renderExercises() {
  return render(
    <MemoryRouter initialEntries={["/exercises"]}>
      <Exercises />
    </MemoryRouter>,
  );
}

describe("Exercises page", () => {
  it("renders exercises from the database", async () => {
    renderExercises();

    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
    });

    expect(screen.getByText("Squat")).toBeInTheDocument();
    expect(screen.getByText("Overhead Press")).toBeInTheDocument();
    // "Incline Dumbbell Press" appears both as exercise card and substitution pill
    expect(screen.getAllByText("Incline Dumbbell Press").length).toBeGreaterThanOrEqual(1);
  });

  it("groups exercises by muscle group", async () => {
    renderExercises();

    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
    });

    // Group headers contain muscle group name (button elements)
    const groupButtons = screen.getAllByRole("button");
    const groupNames = groupButtons.map((btn) => btn.textContent);
    expect(groupNames.some((n) => n?.includes("Chest"))).toBe(true);
    expect(groupNames.some((n) => n?.includes("Legs"))).toBe(true);
    expect(groupNames.some((n) => n?.includes("Shoulders"))).toBe(true);
  });

  it("filters exercises by search", async () => {
    const user = userEvent.setup();
    renderExercises();

    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search exercises...");
    await user.type(searchInput, "bench");

    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.queryByText("Squat")).not.toBeInTheDocument();
    expect(screen.queryByText("Overhead Press")).not.toBeInTheDocument();
  });

  it("navigates to exercise log on click", async () => {
    const user = userEvent.setup();
    renderExercises();

    await waitFor(() => {
      expect(screen.getByText("Squat")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Squat"));

    expect(mockNavigate).toHaveBeenCalledWith("/exercises/ex-2/log");
  });

  it("shows substitution exercises", async () => {
    renderExercises();

    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
    });

    // "Incline Dumbbell Press" appears as both a regular exercise card and a substitution pill
    await waitFor(() => {
      const matches = screen.getAllByText("Incline Dumbbell Press");
      // At least 2: one as exercise card, one as substitution pill under Bench Press
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    // The "Subs:" label should be present
    expect(screen.getByText("Subs:")).toBeInTheDocument();
  });
});
