import { useState, useCallback } from "react";
import { useAuthContext } from "@/context/AuthContext";
import {
  api,
  setTokens,
  clearTokens,
  ApiError,
  getRefreshToken,
} from "@/api/client";
import { db } from "@/db/index";
import { hydrateFromApi } from "@/db/hydrate";
import type {
  TokenResponse,
  UserResponse,
  LoginRequest,
  RegisterRequest,
} from "@/types";

interface UseAuthReturn {
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useAuth(): UseAuthReturn {
  const { dispatch } = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const body: LoginRequest = { email, password };
        const tokens = await api.post<TokenResponse>("/auth/login", body);
        setTokens(tokens);

        const user = await api.get<UserResponse>("/auth/me");
        dispatch({
          type: "LOGIN_SUCCESS",
          payload: {
            user,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
          },
        });

        // Hydrate Dexie from API so the new user has fresh data
        void hydrateFromApi(user.id);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Login failed";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [dispatch],
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const body: RegisterRequest = {
          email,
          password,
          display_name: displayName,
        };
        await api.post<UserResponse>("/auth/register", body);

        const tokens = await api.post<TokenResponse>("/auth/login", {
          email,
          password,
        });
        setTokens(tokens);

        const user = await api.get<UserResponse>("/auth/me");
        dispatch({
          type: "LOGIN_SUCCESS",
          payload: {
            user,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
          },
        });

        // Hydrate Dexie from API so the new user has fresh data
        void hydrateFromApi(user.id);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Registration failed";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [dispatch],
  );

  const logout = useCallback(async () => {
    try {
      const refresh = getRefreshToken();
      if (refresh) {
        await api.post("/auth/logout", { refresh_token: refresh });
      }
    } catch {
      // Logout should succeed even if the API call fails
    } finally {
      clearTokens();
      // Clear all Dexie tables so the next user doesn't see stale data
      await Promise.all(db.tables.map((table) => table.clear()));
      dispatch({ type: "LOGOUT" });
    }
  }, [dispatch]);

  const refreshToken = useCallback(async () => {
    const refresh = getRefreshToken();
    if (!refresh) {
      dispatch({ type: "LOGOUT" });
      return;
    }

    try {
      const tokens = await api.post<TokenResponse>("/auth/refresh", {
        refresh_token: refresh,
      });
      setTokens(tokens);

      const user = await api.get<UserResponse>("/auth/me");
      dispatch({
        type: "LOGIN_SUCCESS",
        payload: {
          user,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        },
      });
    } catch {
      clearTokens();
      dispatch({ type: "LOGOUT" });
    }
  }, [dispatch]);

  return { login, register, logout, refreshToken, isLoading, error };
}
