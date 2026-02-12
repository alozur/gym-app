import { useSync } from "@/hooks/useSync";
import { RefreshCw } from "lucide-react";

export function SyncIndicator() {
  const { isOnline, pendingCount, isSyncing } = useSync();

  return (
    <div className="flex items-center gap-2 text-sm">
      {isSyncing ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
      ) : (
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            isOnline ? "bg-green-500" : "bg-red-500"
          }`}
          aria-label={isOnline ? "Online" : "Offline"}
        />
      )}

      <span className="text-muted-foreground">
        {isSyncing ? "Syncing..." : isOnline ? "Online" : "Offline"}
      </span>

      {pendingCount > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-medium text-white">
          {pendingCount}
        </span>
      )}
    </div>
  );
}
