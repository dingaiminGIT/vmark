/**
 * Block Escape TipTap Extension
 *
 * Handles ArrowUp/ArrowDown at list and blockquote boundaries in WYSIWYG mode:
 * - ArrowUp at first item of first-block list → insert paragraph before
 * - ArrowDown at last item of last-block list → insert paragraph after
 * - ArrowUp at start of first-block blockquote → insert paragraph before
 * - ArrowDown at end of last-block blockquote → insert paragraph after
 *
 * This is similar to tableEscape but for lists and blockquotes.
 */

import { Extension } from "@tiptap/core";
import { keymap } from "@tiptap/pm/keymap";
import type { EditorView } from "@tiptap/pm/view";
import type { Command } from "@tiptap/pm/state";
import { escapeListUp, escapeListDown } from "@/plugins/listEscape";
import { escapeBlockquoteUp, escapeBlockquoteDown } from "@/plugins/blockquoteEscape";
import { guardProseMirrorCommand } from "@/utils/imeGuard";

/**
 * Combined handler for ArrowUp - tries list first, then blockquote.
 * Exported for testing.
 */
export function handleEscapeUp(view: EditorView): boolean {
  // Try list escape first
  if (escapeListUp(view)) return true;
  // Try blockquote escape
  if (escapeBlockquoteUp(view)) return true;
  // Not handled - let default behavior proceed
  return false;
}

/**
 * Combined handler for ArrowDown - tries list first, then blockquote.
 * Exported for testing.
 */
export function handleEscapeDown(view: EditorView): boolean {
  // Try list escape first
  if (escapeListDown(view)) return true;
  // Try blockquote escape
  if (escapeBlockquoteDown(view)) return true;
  // Not handled - let default behavior proceed
  return false;
}

/**
 * Wrap handler as ProseMirror command.
 * Exported for testing.
 */
export function asCommand(fn: (view: EditorView) => boolean): Command {
  return (_state, _dispatch, view) => {
    if (!view) return false;
    return fn(view as unknown as EditorView);
  };
}

/**
 * TipTap extension for list and blockquote escape handling.
 */
export const blockEscapeExtension = Extension.create({
  name: "blockEscape",
  priority: 1040, // Slightly lower than tableUI (1050) so table escape runs first

  addProseMirrorPlugins() {
    return [
      keymap({
        ArrowUp: guardProseMirrorCommand(asCommand(handleEscapeUp)),
        ArrowDown: guardProseMirrorCommand(asCommand(handleEscapeDown)),
      }),
    ];
  },
});
