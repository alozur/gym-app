import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAuthContext } from "@/context/AuthContext";
import { useSync } from "@/hooks/useSync";
import { api } from "@/api/client";
import { db } from "@/db/index";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { UserResponse } from "@/types";
import DataExport from "@/components/DataExport";

export default function Profile() {
  const { logout } = useAuth();
  const { state, dispatch } = useAuthContext();
  const { isOnline, pendingCount, isSyncing, lastSyncError, syncNow } = useSync();
  const navigate = useNavigate();

  const user = state.user;

  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingUnit, setIsSavingUnit] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  async function handleSaveDisplayName() {
    if (!user || displayName.trim() === "" || displayName === user.display_name)
      return;
    setIsSavingName(true);
    setSaveError(null);
    try {
      const updated = await api.put<UserResponse>("/auth/me", {
        display_name: displayName.trim(),
      });
      await db.users.update(user.id, {
        display_name: updated.display_name,
      });
      dispatch({ type: "SET_USER", payload: updated });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSavingName(false);
    }
  }

  async function handleUnitToggle(unit: "kg" | "lbs") {
    if (!user || unit === user.preferred_unit) return;
    setIsSavingUnit(true);
    setSaveError(null);
    try {
      const updated = await api.put<UserResponse>("/auth/me", {
        preferred_unit: unit,
      });
      await db.users.update(user.id, {
        preferred_unit: updated.preferred_unit as "kg" | "lbs",
      });
      dispatch({ type: "SET_USER", payload: updated });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSavingUnit(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-28">
      <main className="mx-auto max-w-md px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">Profile</h1>

        {saveError && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {saveError}
          </div>
        )}

        {/* User Info */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Email
              </label>
              <p className="text-sm">{user.email}</p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Member since
              </label>
              <p className="text-sm">{memberSince}</p>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Display name
              </label>
              <div className="flex gap-2">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  disabled={
                    isSavingName ||
                    displayName.trim() === "" ||
                    displayName === user.display_name
                  }
                  onClick={handleSaveDisplayName}
                >
                  {isSavingName ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unit Preference */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Unit Preference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <Button
                variant={user.preferred_unit === "kg" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                disabled={isSavingUnit}
                onClick={() => handleUnitToggle("kg")}
              >
                kg
              </Button>
              <Button
                variant={user.preferred_unit === "lbs" ? "default" : "ghost"}
                size="sm"
                className="flex-1"
                disabled={isSavingUnit}
                onClick={() => handleUnitToggle("lbs")}
              >
                lbs
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sync Status */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Sync Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="flex items-center gap-1.5 text-sm">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    isOnline ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Pending changes
              </span>
              <span className="text-sm">{pendingCount}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={isSyncing || !isOnline || pendingCount === 0}
              onClick={() => void syncNow()}
            >
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
            {lastSyncError && (
              <p className="text-xs text-destructive">{lastSyncError}</p>
            )}
          </CardContent>
        </Card>

        <div className="mb-4">
          <DataExport />
        </div>

        {/* Logout */}
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => void handleLogout()}
        >
          Log Out
        </Button>
      </main>
    </div>
  );
}
