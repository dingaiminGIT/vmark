import { describe, it, expect, vi, afterEach } from "vitest";
import { triggerSelectionPulse } from "./selectionPulse";

describe("triggerSelectionPulse", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds and removes the pulse class on a timer", () => {
    vi.useFakeTimers();
    const el = document.createElement("div");

    triggerSelectionPulse(el, "pulse-class", 120);
    expect(el.classList.contains("pulse-class")).toBe(true);

    vi.advanceTimersByTime(120);
    expect(el.classList.contains("pulse-class")).toBe(false);
  });

  it("re-triggering resets the timer and keeps class visible", () => {
    vi.useFakeTimers();
    const el = document.createElement("div");

    triggerSelectionPulse(el, "pulse-class", 100);
    expect(el.classList.contains("pulse-class")).toBe(true);

    // Advance 50ms, then re-trigger
    vi.advanceTimersByTime(50);
    expect(el.classList.contains("pulse-class")).toBe(true);

    triggerSelectionPulse(el, "pulse-class", 100);
    expect(el.classList.contains("pulse-class")).toBe(true);

    // Advance another 50ms (100ms total from start, but only 50ms from re-trigger)
    vi.advanceTimersByTime(50);
    expect(el.classList.contains("pulse-class")).toBe(true);

    // Advance remaining 50ms (100ms from re-trigger)
    vi.advanceTimersByTime(50);
    expect(el.classList.contains("pulse-class")).toBe(false);
  });

  it("uses default duration of 180ms when not specified", () => {
    vi.useFakeTimers();
    const el = document.createElement("div");

    triggerSelectionPulse(el, "pulse-class");
    expect(el.classList.contains("pulse-class")).toBe(true);

    vi.advanceTimersByTime(179);
    expect(el.classList.contains("pulse-class")).toBe(true);

    vi.advanceTimersByTime(1);
    expect(el.classList.contains("pulse-class")).toBe(false);
  });
});
