/**
 * Tests for date utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isToday,
  isYesterday,
  formatRelativeTime,
  getDayLabel,
  groupByDay,
} from "./dateUtils";

describe("isToday", () => {
  it("returns true for today's date", () => {
    expect(isToday(new Date())).toBe(true);
  });

  it("returns false for yesterday's date", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isToday(yesterday)).toBe(false);
  });

  it("returns false for tomorrow's date", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isToday(tomorrow)).toBe(false);
  });

  it("returns false for a date from last year", () => {
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    expect(isToday(lastYear)).toBe(false);
  });
});

describe("isYesterday", () => {
  it("returns true for yesterday's date", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isYesterday(yesterday)).toBe(true);
  });

  it("returns false for today's date", () => {
    expect(isYesterday(new Date())).toBe(false);
  });

  it("returns false for two days ago", () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    expect(isYesterday(twoDaysAgo)).toBe(false);
  });

  it("returns false for tomorrow's date", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isYesterday(tomorrow)).toBe(false);
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for very recent times", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 1000)).toBe("just now");
    expect(formatRelativeTime(now - 4000)).toBe("just now");
  });

  it("returns seconds ago for times under a minute", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 10000)).toBe("10s ago");
    expect(formatRelativeTime(now - 30000)).toBe("30s ago");
    expect(formatRelativeTime(now - 59000)).toBe("59s ago");
  });

  it("returns minutes ago for times under an hour", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 60000)).toBe("1m ago");
    expect(formatRelativeTime(now - 120000)).toBe("2m ago");
    expect(formatRelativeTime(now - 3540000)).toBe("59m ago");
  });

  it("returns hours ago for times over an hour", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 3600000)).toBe("1h ago");
    expect(formatRelativeTime(now - 7200000)).toBe("2h ago");
    expect(formatRelativeTime(now - 36000000)).toBe("10h ago");
  });
});

describe("getDayLabel", () => {
  it("returns 'Today' for today's date", () => {
    expect(getDayLabel(new Date())).toBe("Today");
  });

  it("returns 'Yesterday' for yesterday's date", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(getDayLabel(yesterday)).toBe("Yesterday");
  });

  it("returns formatted date for older dates", () => {
    const oldDate = new Date("2024-01-01");
    const label = getDayLabel(oldDate);
    // Should include weekday, month, and day
    expect(label).toContain("Monday");
    expect(label).toContain("Jan");
    expect(label).toContain("1");
  });
});

describe("groupByDay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  interface TestItem {
    id: number;
    timestamp: number;
  }

  it("groups items by day", () => {
    const now = Date.now();
    const yesterday = now - 24 * 60 * 60 * 1000;

    const items: TestItem[] = [
      { id: 1, timestamp: now },
      { id: 2, timestamp: now - 1000 },
      { id: 3, timestamp: yesterday },
    ];

    const groups = groupByDay(items, (item) => item.timestamp);

    expect(groups.get("Today")?.length).toBe(2);
    expect(groups.get("Yesterday")?.length).toBe(1);
  });

  it("handles empty array", () => {
    const groups = groupByDay<TestItem>([], (item) => item.timestamp);
    expect(groups.size).toBe(0);
  });

  it("creates separate groups for different days", () => {
    const now = Date.now();
    const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

    const items: TestItem[] = [
      { id: 1, timestamp: now },
      { id: 2, timestamp: twoDaysAgo },
    ];

    const groups = groupByDay(items, (item) => item.timestamp);

    expect(groups.size).toBe(2);
    expect(groups.has("Today")).toBe(true);
  });

  it("preserves order within groups", () => {
    const now = Date.now();

    const items: TestItem[] = [
      { id: 1, timestamp: now - 1000 },
      { id: 2, timestamp: now - 2000 },
      { id: 3, timestamp: now - 3000 },
    ];

    const groups = groupByDay(items, (item) => item.timestamp);
    const todayItems = groups.get("Today")!;

    expect(todayItems[0].id).toBe(1);
    expect(todayItems[1].id).toBe(2);
    expect(todayItems[2].id).toBe(3);
  });
});
