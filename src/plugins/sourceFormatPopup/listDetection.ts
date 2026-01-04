/**
 * List Detection for Source Mode
 *
 * Detects if cursor is inside a markdown list item.
 */

import type { EditorView } from "@codemirror/view";

export type ListType = "bullet" | "ordered" | "task";

export interface ListItemInfo {
  /** Type of list */
  type: ListType;
  /** Start position of the list item line */
  lineStart: number;
  /** End position of the list item line */
  lineEnd: number;
  /** Indentation level (0-based) */
  indent: number;
  /** For ordered lists, the number; for others, null */
  number: number | null;
  /** For task lists, whether checked */
  checked: boolean | null;
  /** The marker text (e.g., "- ", "1. ", "- [ ] ") */
  marker: string;
  /** Position where content starts (after marker) */
  contentStart: number;
}

/**
 * Detect if cursor is on a list item line and get its info.
 */
export function getListItemInfo(view: EditorView): ListItemInfo | null {
  const { state } = view;
  const { from } = state.selection.main;
  const doc = state.doc;
  const line = doc.lineAt(from);
  const lineText = line.text;

  // Match task list: - [ ] or - [x] or * [ ] etc.
  const taskMatch = lineText.match(/^(\s*)([-*+])\s*\[([ xX])\]\s/);
  if (taskMatch) {
    const indent = taskMatch[1].length;
    const checked = taskMatch[3].toLowerCase() === "x";
    const marker = taskMatch[0];
    return {
      type: "task",
      lineStart: line.from,
      lineEnd: line.to,
      indent: Math.floor(indent / 2),
      number: null,
      checked,
      marker,
      contentStart: line.from + marker.length,
    };
  }

  // Match unordered list: - , * , +
  const bulletMatch = lineText.match(/^(\s*)([-*+])\s/);
  if (bulletMatch) {
    const indent = bulletMatch[1].length;
    const marker = bulletMatch[0];
    return {
      type: "bullet",
      lineStart: line.from,
      lineEnd: line.to,
      indent: Math.floor(indent / 2),
      number: null,
      checked: null,
      marker,
      contentStart: line.from + marker.length,
    };
  }

  // Match ordered list: 1. , 2. , etc.
  const orderedMatch = lineText.match(/^(\s*)(\d+)\.\s/);
  if (orderedMatch) {
    const indent = orderedMatch[1].length;
    const num = parseInt(orderedMatch[2], 10);
    const marker = orderedMatch[0];
    return {
      type: "ordered",
      lineStart: line.from,
      lineEnd: line.to,
      indent: Math.floor(indent / 2),
      number: num,
      checked: null,
      marker,
      contentStart: line.from + marker.length,
    };
  }

  return null;
}
