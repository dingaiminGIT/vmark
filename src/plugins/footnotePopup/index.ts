/**
 * Footnote Popup Plugin
 *
 * Shows a tooltip popup when hovering over footnote references.
 * Clicking the popup scrolls to the footnote definition.
 */

import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey, PluginView, Transaction } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { FootnotePopupView } from "./FootnotePopupView";
import { useFootnotePopupStore } from "@/stores/footnotePopupStore";
import {
  scrollToPosition,
  findFootnoteDefinition,
  findFootnoteReference,
  getFootnoteRefFromTarget,
  getFootnoteDefFromTarget,
} from "./utils";
import {
  getReferenceLabels,
  getDefinitionInfo,
  createRenumberTransaction,
  createCleanupAndRenumberTransaction,
} from "./footnoteCleanup";

export const footnotePopupPluginKey = new PluginKey("footnotePopup");

// Timing constants
/** Delay before showing popup on hover (avoids flickering on quick mouse moves) */
const HOVER_OPEN_DELAY_MS = 150;
/** Delay before closing popup on mouse out (allows moving to popup) */
const HOVER_CLOSE_DELAY_MS = 100;

let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
let closeTimeout: ReturnType<typeof setTimeout> | null = null;
let currentRefElement: HTMLElement | null = null;

/** Clear hover open timeout */
function clearHoverTimeout() {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
    hoverTimeout = null;
  }
}

/** Clear hover close timeout */
function clearCloseTimeout() {
  if (closeTimeout) {
    clearTimeout(closeTimeout);
    closeTimeout = null;
  }
}

/** Reset all hover state (call on plugin destroy) */
export function resetHoverState() {
  clearHoverTimeout();
  clearCloseTimeout();
  currentRefElement = null;
}

/**
 * Handle mouse enter on footnote reference.
 */
function handleMouseOver(view: EditorView, event: MouseEvent): boolean {
  const refElement = getFootnoteRefFromTarget(event.target);

  if (!refElement) {
    return false;
  }

  // Avoid re-triggering on same element
  if (currentRefElement === refElement) {
    return false;
  }

  // Clear any pending close
  clearCloseTimeout();

  // Clear any pending open timeout
  clearHoverTimeout();

  // Delay to avoid flickering on quick mouse moves
  hoverTimeout = setTimeout(() => {
    const label = refElement.getAttribute("data-label");
    if (!label) {
      // No label - don't set currentRefElement so we can retry
      return;
    }

    currentRefElement = refElement;

    const definition = findFootnoteDefinition(view, label);
    const content = definition?.content ?? "Footnote not found";
    const defPos = definition?.pos ?? null;

    const rect = refElement.getBoundingClientRect();
    useFootnotePopupStore.getState().openPopup(label, content, rect, defPos);
  }, HOVER_OPEN_DELAY_MS);

  return false;
}

/**
 * Handle mouse leave from footnote reference.
 */
function handleMouseOut(_view: EditorView, event: MouseEvent): boolean {
  const relatedTarget = event.relatedTarget as HTMLElement | null;

  // Check if moving to the popup itself
  if (relatedTarget?.closest(".footnote-popup")) {
    return false;
  }

  // Check if still on a footnote reference
  if (relatedTarget && getFootnoteRefFromTarget(relatedTarget)) {
    return false;
  }

  // Clear hover open timeout and state
  clearHoverTimeout();
  currentRefElement = null;

  // Delay closing to allow moving to popup
  clearCloseTimeout();
  closeTimeout = setTimeout(() => {
    const popup = document.querySelector(".footnote-popup");
    if (!popup?.matches(":hover")) {
      useFootnotePopupStore.getState().closePopup();
    }
  }, HOVER_CLOSE_DELAY_MS);

  return false;
}

/**
 * Handle mousedown on footnote reference to prevent selection.
 * This runs BEFORE ProseMirror's default selection handling.
 */
function handleMouseDown(_view: EditorView, event: MouseEvent): boolean {
  const refElement = getFootnoteRefFromTarget(event.target);
  if (refElement) {
    // Prevent default selection behavior for atomic footnote nodes
    return true;
  }
  return false;
}

/**
 * Handle click on footnote reference or definition.
 * - Click on reference: scroll to definition
 * - Click on definition: scroll back to reference
 */
function handleClick(view: EditorView, _pos: number, event: MouseEvent): boolean {
  // Check for footnote reference click -> scroll to definition
  const refElement = getFootnoteRefFromTarget(event.target);
  if (refElement) {
    const label = refElement.getAttribute("data-label");
    if (label) {
      const definition = findFootnoteDefinition(view, label);
      if (definition?.pos !== undefined) {
        scrollToPosition(view, definition.pos);
        return true; // Prevent default selection behavior
      }
    }
  }

  // Check for footnote definition click -> go back to reference
  const defElement = getFootnoteDefFromTarget(event.target);
  if (defElement) {
    const label = defElement.getAttribute("data-label");
    if (label) {
      const refPos = findFootnoteReference(view, label);
      if (refPos !== null) {
        scrollToPosition(view, refPos);
        return true; // Prevent default
      }
    }
  }

  return false;
}

/**
 * Plugin view that manages the FootnotePopupView lifecycle.
 * Popup shows via hover, click, or explicit open (new footnote insertion).
 */
class FootnotePopupPluginView implements PluginView {
  private popupView: FootnotePopupView;

  constructor(view: EditorView) {
    this.popupView = new FootnotePopupView(view);
  }

  update() {
    // Update popup position if open
    this.popupView.update();
  }

  destroy() {
    // Clear module-level hover timeouts to prevent stale callbacks
    resetHoverState();
    this.popupView.destroy();
  }
}

/**
 * Create the footnote popup plugin.
 */
export const footnotePopupPlugin = $prose(() => {
  return new Plugin({
    key: footnotePopupPluginKey,
    view(editorView: EditorView) {
      return new FootnotePopupPluginView(editorView);
    },
    props: {
      handleClick,
      handleDOMEvents: {
        mousedown: handleMouseDown,
        mouseover: handleMouseOver,
        mouseout: handleMouseOut,
      },
    },
    /**
     * Append a transaction to clean up orphaned definitions and renumber.
     * Triggers when footnote references are deleted.
     */
    appendTransaction(transactions: readonly Transaction[], oldState, newState) {
      // Get node types from schema
      const refType = newState.schema.nodes.footnote_reference;
      const defType = newState.schema.nodes.footnote_definition;
      if (!refType || !defType) return null;

      // Only process if document changed
      const docChanged = transactions.some(tr => tr.docChanged);
      if (!docChanged) return null;

      // Get reference labels before and after
      const oldRefLabels = getReferenceLabels(oldState.doc);
      const newRefLabels = getReferenceLabels(newState.doc);

      // Check if any reference was deleted
      let refDeleted = false;
      for (const label of oldRefLabels) {
        if (!newRefLabels.has(label)) {
          refDeleted = true;
          break;
        }
      }

      if (!refDeleted) return null;

      // Get current definitions
      const defs = getDefinitionInfo(newState.doc);

      // Find orphaned definitions (no matching reference)
      const orphanedDefs = defs.filter(d => !newRefLabels.has(d.label));

      if (orphanedDefs.length === 0 && newRefLabels.size === 0) {
        // All footnotes deleted - just remove remaining definitions
        if (defs.length > 0) {
          let tr = newState.tr;
          const sortedDefs = [...defs].sort((a, b) => b.pos - a.pos);
          for (const def of sortedDefs) {
            tr = tr.delete(def.pos, def.pos + def.size);
          }
          return tr;
        }
        return null;
      }

      if (orphanedDefs.length === 0) {
        // No orphans but refs changed - need to renumber
        return createRenumberTransaction(newState, refType, defType);
      }

      // Delete orphans and renumber in one transaction
      return createCleanupAndRenumberTransaction(
        newState,
        newRefLabels,
        refType,
        defType
      );
    },
  });
});
