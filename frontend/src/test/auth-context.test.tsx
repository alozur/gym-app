import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";

// Mock the api client module
vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn().mockRejectedValue(new Error("Not authenticated")),
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

import { api, getAccessToken, getRefreshToken } from "@/api/client";
import { AuthProvider, useAuthContext } from "@/context/AuthContext";

beforeEach(() => {
  vi.clearAllMocks();
  // Reset default behavior: no tokens, api.get rejects
  vi.mocked(getAccessToken).mockReturnValue(null);
  vi.mocked(getRefreshToken).mockReturnValue(null);
  vi.mocked(api.get).mockRejectedValue(new Error("Not authenticated"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

function TestConsumer() {
  const { state, dispatch } = useAuthContext();
  return (
    <div>
      <p data-testid="authenticated">{String(state.isAuthenticated)}</p>
      <p data-testid="loading">{String(state.isLoading)}</p>
      <p data-testid="user">{state.user?.email ?? "none"}</p>
      <button
        onClick={() =>
          dispatch({
            type: "LOGIN_SUCCESS",
            payload: {
              user: {
                id: "u1",
                email: "test@test.com",
                display_name: "Test",
                preferred_unit: "kg",
                created_at: "2024-01-01",
              },
              accessToken: "at",
              refreshToken: "rt",
            },
          })
        }
      >
        login
      </button>
      <button onClick={() => dispatch({ type: "LOGOUT" })}>logout</button>
    </div>
  );
}

describe("AuthProvider", () => {
  it("renders children", async () => {
    render(
      <AuthProvider>
        <p>Hello World</p>
      </AuthProvider>,
    );
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("starts with isLoading true and sets to false when no tokens", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
  });

  it("dispatches LOGIN_SUCCESS and updates state", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    act(() => {
      screen.getByText("login").click();
    });

    expect(screen.getByTestId("authenticated").textContent).toBe("true");
    expect(screen.getByTestId("user").textContent).toBe("test@test.com");
  });

  it("dispatches LOGOUT and clears state", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    act(() => {
      screen.getByText("login").click();
    });
    expect(screen.getByTestId("authenticated").textContent).toBe("true");

    act(() => {
      screen.getByText("logout").click();
    });
    expect(screen.getByTestId("authenticated").textContent).toBe("false");
    expect(screen.getByTestId("user").textContent).toBe("none");
  });

  it("fetches user on mount when tokens exist", async () => {
    const mockUser = {
      id: "u1",
      email: "auto@test.com",
      display_name: "Auto",
      preferred_unit: "kg",
      created_at: "2024-01-01",
    };

    vi.mocked(getAccessToken).mockReturnValue("stored-access");
    vi.mocked(getRefreshToken).mockReturnValue("stored-refresh");
    vi.mocked(api.get).mockResolvedValueOnce(mockUser);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("authenticated").textContent).toBe("true");
    });
    expect(screen.getByTestId("user").textContent).toBe("auto@test.com");
    expect(api.get).toHaveBeenCalledWith("/auth/me");
  });

  it("dispatches LOGOUT on auth:logout custom event", async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    // Login first
    act(() => {
      screen.getByText("login").click();
    });
    expect(screen.getByTestId("authenticated").textContent).toBe("true");

    // Fire custom event
    act(() => {
      window.dispatchEvent(new CustomEvent("auth:logout"));
    });

    expect(screen.getByTestId("authenticated").textContent).toBe("false");
  });
});

describe("useAuthContext", () => {
  it("throws when used outside AuthProvider", () => {
    function BadConsumer() {
      useAuthContext();
      return null;
    }

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<BadConsumer />)).toThrow(
      "useAuthContext must be used within an AuthProvider",
    );

    consoleSpy.mockRestore();
  });
});
