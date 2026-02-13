import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  getAccessToken: vi.fn(() => null),
  getRefreshToken: vi.fn(() => null),
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
}));

vi.mock("@/db/index", async () => {
  const { GymTrackerDB, SYNC_STATUS } = await import("@/db/schema");
  const instance = new GymTrackerDB();
  return { db: instance, SYNC_STATUS, GymTrackerDB };
});

import { db } from "@/db/index";
import DataExport from "@/components/DataExport";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

function renderDataExport() {
  return render(<DataExport />);
}

describe("DataExport", () => {
  it("renders Export Data button", () => {
    renderDataExport();

    expect(screen.getByRole("button", { name: /export data/i })).toBeInTheDocument();
  });

  it("opens dialog with format options when button is clicked", async () => {
    const user = userEvent.setup();
    renderDataExport();

    await user.click(screen.getByRole("button", { name: /export data/i }));

    await waitFor(() => {
      expect(screen.getByText("Export Workout Data")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("CSV")).toBeInTheDocument();
    expect(screen.getByLabelText("JSON")).toBeInTheDocument();
  });

  it("shows scope options in dialog", async () => {
    const user = userEvent.setup();
    renderDataExport();

    await user.click(screen.getByRole("button", { name: /export data/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("All Data")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Last 4 Weeks")).toBeInTheDocument();
    expect(screen.getByLabelText("Last 12 Weeks")).toBeInTheDocument();
  });

  it("download button is present in dialog", async () => {
    const user = userEvent.setup();
    renderDataExport();

    await user.click(screen.getByRole("button", { name: /export data/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
    });

    // Cancel button also present
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});
