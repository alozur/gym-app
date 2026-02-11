import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

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

// Mock db/index with dynamic import to avoid hoisting issues
vi.mock("@/db/index", async () => {
  const { GymTrackerDB, SYNC_STATUS } = await import("@/db/schema");
  const instance = new GymTrackerDB();
  return {
    db: instance,
    SYNC_STATUS,
    GymTrackerDB,
  };
});

// Mock uuid to return predictable values
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

// Import AFTER mocks
import { db } from "@/db/index";
import type { DbExercise } from "@/db/schema";
import { AuthProvider } from "@/context/AuthContext";
import TemplateBuilder from "@/pages/TemplateBuilder";

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

function renderTemplateBuilder() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TemplateBuilder />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  uuidCounter = 0;

  await db.delete();
  await db.open();
  await db.exercises.bulkAdd(sampleExercises);
});

describe("TemplateBuilder", () => {
  it("renders the form with template name input and add exercise button", async () => {
    renderTemplateBuilder();

    await waitFor(() => {
      expect(screen.getByLabelText("Template Name")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /add exercise/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("New Template")).toBeInTheDocument();
  });

  it("opens the exercise picker dialog and adds an exercise", async () => {
    const user = userEvent.setup();
    renderTemplateBuilder();

    await waitFor(() => {
      expect(screen.getByLabelText("Template Name")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add exercise/i }));

    await waitFor(() => {
      expect(screen.getByText("Add Exercise")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Bench Press"));

    await waitFor(() => {
      const cards = screen.getAllByText("Bench Press");
      expect(cards.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows validation error when saving without a name", async () => {
    const user = userEvent.setup();
    renderTemplateBuilder();

    await waitFor(() => {
      expect(screen.getByLabelText("Template Name")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /save template/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Template name is required"),
      ).toBeInTheDocument();
    });
  });

  it("shows validation error when saving without exercises", async () => {
    const user = userEvent.setup();
    renderTemplateBuilder();

    await waitFor(() => {
      expect(screen.getByLabelText("Template Name")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Template Name"), "Test Template");

    await user.click(screen.getByRole("button", { name: /save template/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Add at least one exercise"),
      ).toBeInTheDocument();
    });
  });

  it("saves template to Dexie when form is valid", async () => {
    const user = userEvent.setup();
    renderTemplateBuilder();

    await waitFor(() => {
      expect(screen.getByLabelText("Template Name")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Template Name"), "Push Day");

    await user.click(screen.getByRole("button", { name: /add exercise/i }));

    await waitFor(() => {
      expect(screen.getByText("Add Exercise")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Bench Press"));

    await waitFor(() => {
      const cards = screen.getAllByText("Bench Press");
      expect(cards.length).toBeGreaterThanOrEqual(1);
    });

    await user.click(screen.getByRole("button", { name: /save template/i }));

    await waitFor(async () => {
      const templates = await db.workoutTemplates.toArray();
      expect(templates.length).toBe(1);
      expect(templates[0].name).toBe("Push Day");
    });

    const templateExercises = await db.templateExercises.toArray();
    expect(templateExercises.length).toBe(2);
    expect(
      templateExercises.some((te) => te.week_type === "normal"),
    ).toBe(true);
    expect(
      templateExercises.some((te) => te.week_type === "deload"),
    ).toBe(true);
  });
});
