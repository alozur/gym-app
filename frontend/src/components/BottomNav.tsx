import { useLocation, useNavigate } from "react-router-dom";
import { ClipboardList, Dumbbell, BarChart3, User } from "lucide-react";

interface NavTab {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string | null;
  isActive: (pathname: string) => boolean;
}

const tabs: NavTab[] = [
  {
    label: "Programs",
    icon: ClipboardList,
    path: "/programs",
    isActive: (p) => p.startsWith("/programs"),
  },
  {
    label: "Workout",
    icon: Dumbbell,
    path: "/workout",
    isActive: (p) => p === "/workout",
  },
  {
    label: "Dashboard",
    icon: BarChart3,
    path: "/dashboard",
    isActive: (p) => p.startsWith("/dashboard"),
  },
  {
    label: "Profile",
    icon: User,
    path: "/profile",
    isActive: (p) => p === "/profile",
  },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background">
      <div className="mx-auto flex min-h-[56px] max-w-md items-stretch">
        {tabs.map((tab) => {
          const active = tab.isActive(pathname);
          const Icon = tab.icon;
          return (
            <button
              key={tab.label}
              type="button"
              onClick={() => {
                if (tab.path) {
                  navigate(tab.path);
                }
              }}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
