/**
 * Inline Math Plugin
 *
 * Handles selection behavior for inline math nodes.
 * Prevents unexpected text selection when clicking on atomic math nodes.
 */

import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { mathInlineId } from "./inline-latex";

export const mathInlinePluginKey = new PluginKey("mathInline");

/**
 * Check if the event target is an inline math element.
 */
function getMathInlineFromTarget(target: EventTarget | null): HTMLElement | null {
  if (!target || !(target instanceof HTMLElement)) return null;
  return target.closest(`span[data-type="${mathInlineId}"]`);
}

/**
 * Handle mousedown on inline math to prevent selection.
 * This runs BEFORE ProseMirror's default selection handling.
 */
function handleMouseDown(_view: EditorView, event: MouseEvent): boolean {
  const mathElement = getMathInlineFromTarget(event.target);
  if (mathElement) {
    // Prevent default selection behavior for atomic math nodes
    return true;
  }
  return false;
}

/**
 * Plugin for inline math selection handling.
 */
export const mathInlinePlugin = $prose(() => {
  return new Plugin({
    key: mathInlinePluginKey,
    props: {
      handleDOMEvents: {
        mousedown: handleMouseDown,
      },
    },
  });
});
