import { useSync } from "@/hooks/useSync";
import { WifiOff } from "lucide-react";

export default function OfflineBanner() {
  const { isOnline } = useSync();

  if (isOnline) return null;

  return (
    <div className="bg-amber-500/10 text-amber-700 dark:text-amber-400">
      <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-2 text-sm">
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>You&apos;re offline &mdash; data is saved locally</span>
      </div>
    </div>
  );
}
