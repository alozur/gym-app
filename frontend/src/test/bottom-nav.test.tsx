import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import BottomNav from "@/components/BottomNav";

beforeEach(() => {
  vi.clearAllMocks();
});

function renderNav(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

describe("BottomNav", () => {
  it("renders all four tab labels", () => {
    renderNav("/templates");

    expect(screen.getByText("Templates")).toBeInTheDocument();
    expect(screen.getByText("Workout")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("highlights the active tab based on current route", () => {
    renderNav("/templates");

    const templatesButton = screen.getByText("Templates").closest("button");
    const workoutButton = screen.getByText("Workout").closest("button");

    expect(templatesButton?.className).toContain("text-primary");
    expect(workoutButton?.className).toContain("text-muted-foreground");
  });

  it("highlights Dashboard tab when on /dashboard", () => {
    renderNav("/dashboard");

    const dashboardButton = screen.getByText("Dashboard").closest("button");
    expect(dashboardButton?.className).toContain("text-primary");
  });

  it("navigates when a tab is clicked", async () => {
    const user = userEvent.setup();
    renderNav("/templates");

    await user.click(screen.getByText("Workout"));
    expect(mockNavigate).toHaveBeenCalledWith("/workout");
  });

  it("navigates to /profile when Profile tab is clicked", async () => {
    const user = userEvent.setup();
    renderNav("/templates");

    await user.click(screen.getByText("Profile"));
    expect(mockNavigate).toHaveBeenCalledWith("/profile");
  });
});
