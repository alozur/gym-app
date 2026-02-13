import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const mockLogout = vi.fn().mockResolvedValue(undefined);
const mockSyncNow = vi.fn().mockResolvedValue(undefined);
const mockDispatch = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getAccessToken: vi.fn(() => "test-token"),
  getRefreshToken: vi.fn(() => "test-refresh"),
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  ApiError: class extends Error {
    status: number;
    constructor(status: number, msg: string) {
      super(msg);
      this.status = status;
    }
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    logout: mockLogout,
    login: vi.fn(),
    register: vi.fn(),
    refreshToken: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useSync", () => ({
  useSync: () => ({
    isOnline: true,
    pendingCount: 3,
    isSyncing: false,
    lastSyncError: null,
    syncNow: mockSyncNow,
  }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuthContext: () => ({
    state: {
      user: {
        id: "user-1",
        email: "test@example.com",
        display_name: "Test User",
        preferred_unit: "kg",
        created_at: "2024-01-15T00:00:00Z",
      },
      accessToken: "token",
      refreshToken: "refresh",
      isAuthenticated: true,
      isLoading: false,
    },
    dispatch: mockDispatch,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/db/index", () => ({
  db: {
    users: { update: vi.fn() },
  },
}));

vi.mock("@/components/DataExport", () => ({
  default: () => <button>Export Data</button>,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import Profile from "@/pages/Profile";

beforeEach(() => {
  vi.clearAllMocks();
});

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Profile />
    </MemoryRouter>,
  );
}

describe("Profile", () => {
  it("renders user display name and email", () => {
    renderProfile();

    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
  });

  it("renders unit toggle with kg and lbs buttons", () => {
    renderProfile();

    expect(screen.getByRole("button", { name: "kg" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "lbs" })).toBeInTheDocument();
  });

  it("logout button calls logout and navigates to /login", async () => {
    const user = userEvent.setup();
    renderProfile();

    const logoutButton = screen.getByRole("button", { name: "Log Out" });
    await user.click(logoutButton);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("shows pending count and online status", () => {
    renderProfile();

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
  });

  it("save button is disabled when display name has not changed", () => {
    renderProfile();

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();
  });

  it("save button enables when display name is changed", async () => {
    const user = userEvent.setup();
    renderProfile();

    const input = screen.getByDisplayValue("Test User");
    await user.clear(input);
    await user.type(input, "New Name");

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).not.toBeDisabled();
  });

  it("renders Export Data button", () => {
    renderProfile();

    expect(screen.getByRole("button", { name: "Export Data" })).toBeInTheDocument();
  });
});
