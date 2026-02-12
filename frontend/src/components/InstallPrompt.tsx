import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "install-prompt-dismissed";

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    function handlePrompt(e: Event) {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setShow(true);
    }

    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  }

  async function install() {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === "accepted") {
      setShow(false);
    }
    deferredPrompt.current = null;
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-[72px] left-0 right-0 z-40 px-4 animate-in slide-in-from-bottom-4">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-lg">
        <Download className="h-5 w-5 shrink-0 text-primary" />
        <p className="flex-1 text-sm font-medium">Install Gym Tracker</p>
        <Button size="sm" onClick={() => void install()}>
          Install
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
