/**
 * Trigger Menu Utilities
 *
 * Pure functions for filtering and grouping menu items.
 */

import type { EditorView } from "@milkdown/kit/prose/view";
import type { TriggerMenuItem } from "./types";

/**
 * Check if selection is in a code block.
 */
export function isInCodeBlock(view: EditorView): boolean {
  const { $from } = view.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "code_block") {
      return true;
    }
  }
  return false;
}

/**
 * Flatten nested items for filtering - returns all leaf items with their full path.
 */
function flattenItems(items: TriggerMenuItem[]): TriggerMenuItem[] {
  const result: TriggerMenuItem[] = [];
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      result.push(...flattenItems(item.children));
    } else if (item.action) {
      result.push(item);
    }
  }
  return result;
}

/**
 * Filter items based on search text - searches through nested items.
 */
export function filterItems(
  items: TriggerMenuItem[],
  filter: string
): TriggerMenuItem[] {
  if (!filter) {
    return items;
  }

  const allItems = flattenItems(items);
  const lowerFilter = filter.toLowerCase();
  return allItems.filter(
    (item) =>
      item.label.toLowerCase().includes(lowerFilter) ||
      item.keywords?.some((k) => k.includes(lowerFilter))
  );
}

/**
 * Group items by their group property.
 */
export function groupItems(
  items: TriggerMenuItem[]
): Map<string, TriggerMenuItem[]> {
  const groups = new Map<string, TriggerMenuItem[]>();
  for (const item of items) {
    const group = item.group || "Other";
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(item);
  }
  return groups;
}
