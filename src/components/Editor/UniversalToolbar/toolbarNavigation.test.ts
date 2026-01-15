/**
 * Toolbar Navigation - Tests
 *
 * TDD tests for keyboard navigation (WI-003).
 */
import { describe, it, expect } from "vitest";
import {
  getNextButtonIndex,
  getPrevButtonIndex,
  getNextGroupFirstIndex,
  getPrevGroupLastIndex,
  getNextFocusableIndex,
  getPrevFocusableIndex,
  getFirstFocusableIndex,
  getLastFocusableIndex,
  getNextGroupFirstFocusableIndex,
  getPrevGroupLastFocusableIndex,
  getNextFocusableIndexInGroup,
  getPrevFocusableIndexInGroup,
} from "./toolbarNavigation";
import { TOOLBAR_GROUPS } from "./toolbarGroups";

// Helper to get total button count
function getTotalButtonCount(): number {
  return TOOLBAR_GROUPS.flatMap((g) => g.buttons).filter(
    (b) => b.type !== "separator"
  ).length;
}

describe("toolbarNavigation", () => {
  describe("getNextButtonIndex", () => {
    it("returns next index within bounds", () => {
      expect(getNextButtonIndex(0, getTotalButtonCount())).toBe(1);
      expect(getNextButtonIndex(5, getTotalButtonCount())).toBe(6);
    });

    it("wraps to 0 at end", () => {
      const total = getTotalButtonCount();
      expect(getNextButtonIndex(total - 1, total)).toBe(0);
    });
  });

  describe("getPrevButtonIndex", () => {
    it("returns previous index within bounds", () => {
      expect(getPrevButtonIndex(5, getTotalButtonCount())).toBe(4);
      expect(getPrevButtonIndex(1, getTotalButtonCount())).toBe(0);
    });

    it("wraps to last at start", () => {
      const total = getTotalButtonCount();
      expect(getPrevButtonIndex(0, total)).toBe(total - 1);
    });
  });

  describe("getNextGroupFirstIndex", () => {
    it("returns first button of next group", () => {
      // Block group has 1 button (heading), inline starts at index 1
      expect(getNextGroupFirstIndex(0)).toBe(1);
    });

    it("wraps to first group at end", () => {
      const total = getTotalButtonCount();
      expect(getNextGroupFirstIndex(total - 1)).toBe(0);
    });
  });

  describe("getPrevGroupLastIndex", () => {
    it("returns last button of previous group", () => {
      // From first button of inline (index 1), go to last of block (index 0)
      expect(getPrevGroupLastIndex(1)).toBe(0);
    });

    it("wraps to last group at start", () => {
      // From block group (index 0), wrap to last button of link group
      const lastIndex = getPrevGroupLastIndex(0);
      const total = getTotalButtonCount();
      expect(lastIndex).toBe(total - 1);
    });
  });

  describe("focusable navigation helpers", () => {
    const total = getTotalButtonCount();
    const isFocusable = (index: number) => index % 2 === 0;

    it("skips non-focusable buttons when moving next/prev", () => {
      expect(getNextFocusableIndex(0, total, isFocusable)).toBe(2);
      expect(getPrevFocusableIndex(2, total, isFocusable)).toBe(0);
    });

    it("finds first and last focusable buttons", () => {
      expect(getFirstFocusableIndex(total, isFocusable)).toBe(0);
      const last = getLastFocusableIndex(total, isFocusable);
      expect(last % 2).toBe(0);
    });

    it("jumps to next/prev focusable group buttons", () => {
      const next = getNextGroupFirstFocusableIndex(0, isFocusable);
      expect(next).toBeGreaterThanOrEqual(0);
      const prev = getPrevGroupLastFocusableIndex(0, isFocusable);
      expect(prev).toBeGreaterThanOrEqual(0);
    });

    it("moves within the current group for left/right navigation", () => {
      const groupRangeSize = TOOLBAR_GROUPS[1].buttons.length;
      const groupStart = TOOLBAR_GROUPS[0].buttons.length;
      const current = groupStart;
      const next = getNextFocusableIndexInGroup(current, isFocusable);
      expect(next).toBeGreaterThanOrEqual(groupStart);
      expect(next).toBeLessThan(groupStart + groupRangeSize);

      const prev = getPrevFocusableIndexInGroup(current, isFocusable);
      expect(prev).toBeGreaterThanOrEqual(groupStart);
      expect(prev).toBeLessThan(groupStart + groupRangeSize);
    });
  });
});
