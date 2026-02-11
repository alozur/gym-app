import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// Mock the api client — no external variables in the factory
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
  ApiError: class extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "ApiError";
    }
  },
}));

// Mock useNavigate
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

// Import AFTER mocks are declared
import { api, ApiError } from "@/api/client";
import { AuthProvider } from "@/context/AuthContext";
import Login from "@/pages/Login";

const mockApi = vi.mocked(api);

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Login page", () => {
  it("renders email and password inputs", async () => {
    renderLogin();

    await waitFor(() => {
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Login" }),
    ).toBeInTheDocument();
  });

  it("submitting the form calls the login API", async () => {
    const user = userEvent.setup();

    mockApi.post.mockResolvedValueOnce({
      access_token: "test-access",
      refresh_token: "test-refresh",
      token_type: "bearer",
    });
    mockApi.get.mockResolvedValueOnce({
      id: "u1",
      email: "test@example.com",
      display_name: "Test User",
      preferred_unit: "kg",
      created_at: "2024-01-01",
    });

    renderLogin();

    await waitFor(() => {
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith("/auth/login", {
        email: "test@example.com",
        password: "password123",
      });
    });
  });

  it("displays error message on login failure", async () => {
    const user = userEvent.setup();

    mockApi.post.mockRejectedValueOnce(
      new ApiError(401, "Invalid credentials"),
    );

    renderLogin();

    await waitFor(() => {
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Email"), "bad@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpass");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("has a link to the register page", async () => {
    renderLogin();

    await waitFor(() => {
      expect(screen.getByText("Register")).toBeInTheDocument();
    });

    const registerLink = screen.getByRole("link", { name: "Register" });
    expect(registerLink).toHaveAttribute("href", "/register");
  });
});
