/**
 * Toolbar Navigation - Keyboard handling
 *
 * Pure functions for calculating focus positions during keyboard navigation.
 * No React/DOM dependencies - just index calculations.
 *
 * @module components/Editor/UniversalToolbar/toolbarNavigation
 */
import { TOOLBAR_GROUPS } from "./toolbarGroups";

/**
 * Get flat list of button indices grouped by their parent group.
 * Used for group-aware navigation (Ctrl+Arrow).
 */
function getGroupRanges(): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let offset = 0;

  for (const group of TOOLBAR_GROUPS) {
    const buttonCount = group.buttons.filter((b) => b.type !== "separator").length;
    if (buttonCount > 0) {
      ranges.push({ start: offset, end: offset + buttonCount - 1 });
      offset += buttonCount;
    }
  }

  return ranges;
}

function getGroupRangeForIndex(index: number): { start: number; end: number } | null {
  const ranges = getGroupRanges();
  if (ranges.length === 0) return null;
  for (const range of ranges) {
    if (index >= range.start && index <= range.end) {
      return range;
    }
  }
  return null;
}

function findNextFocusableIndex(
  start: number,
  total: number,
  isFocusable: (index: number) => boolean,
  direction: 1 | -1
): number {
  if (total <= 0) return 0;
  let index = start;

  for (let i = 0; i < total; i++) {
    index = (index + direction + total) % total;
    if (isFocusable(index)) return index;
  }

  return start;
}

/**
 * Get the next button index, wrapping at the end.
 *
 * @param current - Current button index
 * @param total - Total number of buttons
 * @returns Next button index
 */
export function getNextButtonIndex(current: number, total: number): number {
  return (current + 1) % total;
}

/**
 * Get the previous button index, wrapping at the start.
 *
 * @param current - Current button index
 * @param total - Total number of buttons
 * @returns Previous button index
 */
export function getPrevButtonIndex(current: number, total: number): number {
  return (current - 1 + total) % total;
}

/**
 * Get the first button index of the next group.
 * Used for Ctrl+Right / Option+Right navigation.
 *
 * @param current - Current button index
 * @returns First button index of next group
 */
export function getNextGroupFirstIndex(current: number): number {
  const ranges = getGroupRanges();

  // Find which group we're in
  let currentGroupIndex = 0;
  for (let i = 0; i < ranges.length; i++) {
    if (current >= ranges[i].start && current <= ranges[i].end) {
      currentGroupIndex = i;
      break;
    }
  }

  // Move to next group (wrap)
  const nextGroupIndex = (currentGroupIndex + 1) % ranges.length;
  return ranges[nextGroupIndex].start;
}

/**
 * Get the last button index of the previous group.
 * Used for Ctrl+Left / Option+Left navigation.
 *
 * @param current - Current button index
 * @returns Last button index of previous group
 */
export function getPrevGroupLastIndex(current: number): number {
  const ranges = getGroupRanges();

  // Find which group we're in
  let currentGroupIndex = 0;
  for (let i = 0; i < ranges.length; i++) {
    if (current >= ranges[i].start && current <= ranges[i].end) {
      currentGroupIndex = i;
      break;
    }
  }

  // Move to previous group (wrap)
  const prevGroupIndex = (currentGroupIndex - 1 + ranges.length) % ranges.length;
  return ranges[prevGroupIndex].end;
}

/**
 * Get the first button index (for Home key).
 */
export function getFirstButtonIndex(): number {
  return 0;
}

/**
 * Get the last button index (for End key).
 *
 * @param total - Total number of buttons
 */
export function getLastButtonIndex(total: number): number {
  return total - 1;
}

export function getNextFocusableIndex(
  current: number,
  total: number,
  isFocusable: (index: number) => boolean
): number {
  return findNextFocusableIndex(current, total, isFocusable, 1);
}

export function getPrevFocusableIndex(
  current: number,
  total: number,
  isFocusable: (index: number) => boolean
): number {
  return findNextFocusableIndex(current, total, isFocusable, -1);
}

export function getFirstFocusableIndex(
  total: number,
  isFocusable: (index: number) => boolean
): number {
  if (total <= 0) return 0;
  for (let i = 0; i < total; i++) {
    if (isFocusable(i)) return i;
  }
  return 0;
}

export function getLastFocusableIndex(
  total: number,
  isFocusable: (index: number) => boolean
): number {
  if (total <= 0) return 0;
  for (let i = total - 1; i >= 0; i--) {
    if (isFocusable(i)) return i;
  }
  return Math.max(0, total - 1);
}

export function getNextGroupFirstFocusableIndex(
  current: number,
  isFocusable: (index: number) => boolean
): number {
  const ranges = getGroupRanges();
  if (ranges.length === 0) return 0;

  let currentGroupIndex = 0;
  for (let i = 0; i < ranges.length; i++) {
    if (current >= ranges[i].start && current <= ranges[i].end) {
      currentGroupIndex = i;
      break;
    }
  }

  for (let offset = 1; offset <= ranges.length; offset++) {
    const nextGroupIndex = (currentGroupIndex + offset) % ranges.length;
    const range = ranges[nextGroupIndex];
    for (let index = range.start; index <= range.end; index++) {
      if (isFocusable(index)) return index;
    }
  }

  return current;
}

export function getPrevGroupLastFocusableIndex(
  current: number,
  isFocusable: (index: number) => boolean
): number {
  const ranges = getGroupRanges();
  if (ranges.length === 0) return 0;

  let currentGroupIndex = 0;
  for (let i = 0; i < ranges.length; i++) {
    if (current >= ranges[i].start && current <= ranges[i].end) {
      currentGroupIndex = i;
      break;
    }
  }

  for (let offset = 1; offset <= ranges.length; offset++) {
    const prevGroupIndex = (currentGroupIndex - offset + ranges.length) % ranges.length;
    const range = ranges[prevGroupIndex];
    for (let index = range.end; index >= range.start; index--) {
      if (isFocusable(index)) return index;
    }
  }

  return current;
}

export function getNextFocusableIndexInGroup(
  current: number,
  isFocusable: (index: number) => boolean
): number {
  const range = getGroupRangeForIndex(current);
  if (!range) return current;

  const { start, end } = range;
  const total = end - start + 1;
  if (total <= 0) return current;

  let index = current;
  for (let i = 0; i < total; i++) {
    index = index + 1 > end ? start : index + 1;
    if (isFocusable(index)) return index;
  }

  return current;
}

export function getPrevFocusableIndexInGroup(
  current: number,
  isFocusable: (index: number) => boolean
): number {
  const range = getGroupRangeForIndex(current);
  if (!range) return current;

  const { start, end } = range;
  const total = end - start + 1;
  if (total <= 0) return current;

  let index = current;
  for (let i = 0; i < total; i++) {
    index = index - 1 < start ? end : index - 1;
    if (isFocusable(index)) return index;
  }

  return current;
}
