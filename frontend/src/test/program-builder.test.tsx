import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

// Mock api client
vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn(),
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
      isAuthenticated: true,
      isLoading: false,
    },
    dispatch: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Mock uuid
let uuidCounter = 0;
vi.mock("uuid", () => ({
  v4: () => `test-uuid-${++uuidCounter}`,
}));

// Mock useNavigate and useParams
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
  };
});

import { db } from "@/db/index";
import type { DbWorkoutTemplate } from "@/db/schema";
import ProgramBuilder from "@/pages/ProgramBuilder";

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
];

function renderProgramBuilder() {
  return render(
    <MemoryRouter>
      <ProgramBuilder />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  uuidCounter = 0;
  await db.delete();
  await db.open();
  await db.workoutTemplates.bulkAdd(sampleTemplates);
});

describe("ProgramBuilder", () => {
  it("renders the form with name input and deload weeks input", async () => {
    renderProgramBuilder();

    await waitFor(() => {
      expect(screen.getByLabelText("Program Name")).toBeInTheDocument();
    });

    expect(
      screen.getByLabelText("Deload Every N Weeks"),
    ).toBeInTheDocument();
  });

  it("renders Add Routine button", async () => {
    renderProgramBuilder();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /add routine/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders Save button", async () => {
    renderProgramBuilder();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /save program/i }),
      ).toBeInTheDocument();
    });
  });

  it("renders New Program heading", async () => {
    renderProgramBuilder();

    await waitFor(() => {
      expect(screen.getByText("New Program")).toBeInTheDocument();
    });
  });
});
