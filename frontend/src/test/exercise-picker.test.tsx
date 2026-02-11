import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the api client
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

// Mock @/db/index with dynamic import to avoid hoisting issues
vi.mock("@/db/index", async () => {
  const { GymTrackerDB, SYNC_STATUS } = await import("@/db/schema");
  const instance = new GymTrackerDB();
  return {
    db: instance,
    SYNC_STATUS,
    GymTrackerDB,
  };
});

import { db } from "@/db/index";
import type { DbExercise } from "@/db/schema";
import { ExercisePicker } from "@/components/ExercisePicker";

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
    name: "Barbell Row",
    muscle_group: "Back",
    equipment: "Barbell",
    is_custom: false,
    youtube_url: null,
    notes: null,
    created_at: "2024-01-01T00:00:00Z",
    sync_status: "synced",
  },
  {
    id: "ex-5",
    user_id: null,
    name: "Bicep Curl",
    muscle_group: "Arms",
    equipment: "Dumbbell",
    is_custom: false,
    youtube_url: null,
    notes: null,
    created_at: "2024-01-01T00:00:00Z",
    sync_status: "synced",
  },
];

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.exercises.bulkAdd(sampleExercises);
});

describe("ExercisePicker", () => {
  it("renders exercises from the database", async () => {
    const onSelect = vi.fn();
    render(<ExercisePicker onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
    });

    expect(screen.getByText("Squat")).toBeInTheDocument();
    expect(screen.getByText("Overhead Press")).toBeInTheDocument();
    expect(screen.getByText("Barbell Row")).toBeInTheDocument();
    expect(screen.getByText("Bicep Curl")).toBeInTheDocument();
  });

  it("filters exercises by search input", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ExercisePicker onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search exercises...");
    await user.type(searchInput, "bench");

    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.queryByText("Squat")).not.toBeInTheDocument();
    expect(screen.queryByText("Overhead Press")).not.toBeInTheDocument();
  });

  it("filters exercises by muscle group", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ExercisePicker onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
    });

    const chestButton = screen.getByRole("button", { name: "Chest" });
    await user.click(chestButton);

    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.queryByText("Squat")).not.toBeInTheDocument();
    expect(screen.queryByText("Barbell Row")).not.toBeInTheDocument();
  });

  it("calls onSelect when an exercise is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ExercisePicker onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Bench Press"));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ex-1",
        name: "Bench Press",
        muscle_group: "Chest",
      }),
    );
  });

  it("excludes exercises by excludeIds", async () => {
    const onSelect = vi.fn();
    render(<ExercisePicker onSelect={onSelect} excludeIds={["ex-1", "ex-2"]} />);

    await waitFor(() => {
      expect(screen.getByText("Overhead Press")).toBeInTheDocument();
    });

    expect(screen.queryByText("Bench Press")).not.toBeInTheDocument();
    expect(screen.queryByText("Squat")).not.toBeInTheDocument();
  });
});
