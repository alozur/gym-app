import { useCallback } from "react";
import { useAuthContext } from "@/context/AuthContext";
import { api } from "@/api/client";
import { db } from "@/db/index";
import type { UserResponse } from "@/types";

interface UseAuthReturn {
  logout: () => Promise<void>;
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth(): UseAuthReturn {
  const { state, dispatch } = useAuthContext();

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Logout should succeed even if the API call fails
    } finally {
      // Clear Dexie tables so the next user doesn't see stale data
      await Promise.all(db.tables.map((table) => table.clear()));
      dispatch({ type: "LOGOUT" });
      // Redirect to Authelia logout
      window.location.href = "https://auth.zurera.cloud/logout";
    }
  }, [dispatch]);

  return {
    logout,
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
  };
}
