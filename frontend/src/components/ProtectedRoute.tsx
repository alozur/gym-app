import { useAuthContext } from "@/context/AuthContext";
import type { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { state } = useAuthContext();

  if (state.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Authelia handles the redirect if not authenticated.
  // If we get here without a user, reload to trigger Authelia.
  if (!state.isAuthenticated) {
    window.location.reload();
    return null;
  }

  return <>{children}</>;
}
