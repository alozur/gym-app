import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { RestTimer } from "@/components/RestTimer";

describe("RestTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders countdown with correct initial time format", () => {
    render(
      <RestTimer
        durationSeconds={90}
        onComplete={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("1:30")).toBeInTheDocument();
  });

  it("countdown decrements over time", () => {
    render(
      <RestTimer
        durationSeconds={90}
        onComplete={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByText("1:30")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("1:29")).toBeInTheDocument();
  });

  it("skip button calls onDismiss when clicked", () => {
    const onDismiss = vi.fn();

    render(
      <RestTimer
        durationSeconds={90}
        onComplete={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onComplete when countdown reaches 0", () => {
    const onComplete = vi.fn();

    render(
      <RestTimer
        durationSeconds={3}
        onComplete={onComplete}
        onDismiss={vi.fn()}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("progress bar width decreases as time passes", () => {
    render(
      <RestTimer
        durationSeconds={10}
        onComplete={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    const progressBar = document.querySelector("[style]") as HTMLElement;
    expect(progressBar).toBeTruthy();
    expect(progressBar.style.width).toBe("100%");

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(progressBar.style.width).toBe("50%");
  });
});
