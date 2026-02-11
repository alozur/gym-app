import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to mock import.meta.env before importing the module
const BASE_URL = "http://localhost:8000/api";

// We'll test the api client by importing it fresh with mocked fetch
let api: typeof import("@/api/client").api;
let setTokens: typeof import("@/api/client").setTokens;
let clearTokens: typeof import("@/api/client").clearTokens;
let ApiError: typeof import("@/api/client").ApiError;

beforeEach(async () => {
  // Clear localStorage
  localStorage.clear();
  // Reset fetch mock
  vi.stubGlobal("fetch", vi.fn());
  // Re-import the module fresh
  vi.resetModules();
  const mod = await import("@/api/client");
  api = mod.api;
  setTokens = mod.setTokens;
  clearTokens = mod.clearTokens;
  ApiError = mod.ApiError;
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("api client", () => {
  it("adds Authorization header when token exists in localStorage", async () => {
    localStorage.setItem("access_token", "test-token-123");

    const mockResponse = new Response(JSON.stringify({ id: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

    await api.get("/test-endpoint");

    expect(fetch).toHaveBeenCalledOnce();
    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-token-123");
  });

  it("does not add Authorization header when no token exists", async () => {
    const mockResponse = new Response(JSON.stringify({ data: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

    await api.get("/test-endpoint");

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("sends JSON body correctly with POST", async () => {
    const mockResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

    const body = { email: "test@example.com", password: "secret" };
    await api.post("/auth/login", body);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe(`${BASE_URL}/auth/login`);
    expect(options?.method).toBe("POST");
    expect(options?.body).toBe(JSON.stringify(body));
    const headers = options?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("triggers token refresh on 401 response", async () => {
    localStorage.setItem("access_token", "expired-token");
    localStorage.setItem("refresh_token", "valid-refresh");

    // First call returns 401
    const unauthorizedResponse = new Response(
      JSON.stringify({ detail: "Unauthorized" }),
      { status: 401 },
    );

    // Refresh call succeeds
    const refreshResponse = new Response(
      JSON.stringify({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        token_type: "bearer",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

    // Retry call succeeds
    const retryResponse = new Response(JSON.stringify({ id: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce(unauthorizedResponse)
      .mockResolvedValueOnce(refreshResponse)
      .mockResolvedValueOnce(retryResponse);

    const result = await api.get<{ id: number }>("/protected-endpoint");

    expect(result).toEqual({ id: 1 });
    // 3 calls: original, refresh, retry
    expect(fetch).toHaveBeenCalledTimes(3);

    // Refresh endpoint was called
    const [refreshUrl] = vi.mocked(fetch).mock.calls[1];
    expect(refreshUrl).toBe(`${BASE_URL}/auth/refresh`);

    // New token stored
    expect(localStorage.getItem("access_token")).toBe("new-access-token");
  });

  it("throws ApiError on non-OK response", async () => {
    const errorResponse = new Response(
      JSON.stringify({ detail: "Not Found" }),
      { status: 404, statusText: "Not Found" },
    );
    vi.mocked(fetch).mockResolvedValueOnce(errorResponse);

    await expect(api.get("/missing")).rejects.toThrow(ApiError);
    await expect(
      (async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
          new Response(JSON.stringify({ detail: "Not Found" }), {
            status: 404,
          }),
        );
        await api.get("/missing");
      })(),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("setTokens stores tokens and clearTokens removes them", () => {
    setTokens({
      access_token: "a",
      refresh_token: "r",
      token_type: "bearer",
    });
    expect(localStorage.getItem("access_token")).toBe("a");
    expect(localStorage.getItem("refresh_token")).toBe("r");

    clearTokens();
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });
});
