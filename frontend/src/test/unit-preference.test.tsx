import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const mockUser = {
  id: "user-1",
  email: "test@example.com",
  display_name: "Test User",
  preferred_unit: "kg" as string,
  created_at: "2024-01-15T00:00:00Z",
};

vi.mock("@/context/AuthContext", () => ({
  useAuthContext: () => ({
    state: {
      user: mockUser,
      accessToken: "token",
      refreshToken: "refresh",
      isAuthenticated: true,
      isLoading: false,
    },
    dispatch: vi.fn(),
  }),
}));

import { useUnitPreference } from "@/hooks/useUnitPreference";

describe("useUnitPreference", () => {
  it("returns kg values unchanged when unit is kg", () => {
    mockUser.preferred_unit = "kg";

    const { result } = renderHook(() => useUnitPreference());

    expect(result.current.unit).toBe("kg");
    expect(result.current.displayWeight(80)).toBe("80 kg");
  });

  it("converts kg to lbs correctly when unit is lbs", () => {
    mockUser.preferred_unit = "lbs";

    const { result } = renderHook(() => useUnitPreference());

    expect(result.current.unit).toBe("lbs");
    // 80 * 2.20462 = 176.3696, rounded to 1 decimal = 176.4
    expect(result.current.displayWeight(80)).toBe("176.4 lbs");
  });

  it("formats display string with unit suffix", () => {
    mockUser.preferred_unit = "kg";

    const { result } = renderHook(() => useUnitPreference());
    expect(result.current.displayWeight(100)).toBe("100 kg");

    mockUser.preferred_unit = "lbs";
    const { result: result2 } = renderHook(() => useUnitPreference());
    expect(result2.current.displayWeight(100)).toBe("220.5 lbs");
  });

  it("convertWeight converts both directions", () => {
    mockUser.preferred_unit = "lbs";

    const { result } = renderHook(() => useUnitPreference());

    // kg to lbs
    const lbs = result.current.convertWeight(100, "kg");
    expect(lbs).toBe(220.5);

    // lbs to kg (user unit is lbs, so fromUnit=lbs with target=lbs stays same)
    mockUser.preferred_unit = "kg";
    const { result: result2 } = renderHook(() => useUnitPreference());
    const kg = result2.current.convertWeight(220.5, "lbs");
    expect(kg).toBe(100);
  });
});
