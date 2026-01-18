/**
 * Source Mode Math Preview Plugin
 *
 * Shows a floating preview of math when cursor is inside:
 * - Inline math: $...$
 * - Block math: $$...$$ or ```latex...```
 *
 * Reuses the MathPreviewView singleton from the latex plugin.
 */

import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { getMathPreviewView } from "@/plugins/mathPreview/MathPreviewView";
import { findInlineMathAtCursor, findBlockMathAtCursor } from "@/plugins/toolbarActions/sourceAdapterLinks";

class SourceMathPreviewPlugin {
  private view: EditorView;
  private currentMathRange: { from: number; to: number; content: string } | null = null;
  private isBlockMath = false;
  private pendingUpdate = false;

  constructor(view: EditorView) {
    this.view = view;
    this.scheduleCheck();
  }

  update(update: ViewUpdate) {
    if (update.selectionSet || update.docChanged) {
      this.scheduleCheck();
    }
  }

  private scheduleCheck() {
    // Defer layout reading to after the update cycle
    if (this.pendingUpdate) return;
    this.pendingUpdate = true;
    requestAnimationFrame(() => {
      this.pendingUpdate = false;
      this.checkMathAtCursor();
    });
  }

  private checkMathAtCursor() {
    const { from, to } = this.view.state.selection.main;

    // Only show preview for collapsed selection (cursor, not range)
    if (from !== to) {
      this.hidePreview();
      return;
    }

    // Check for block math first ($$...$$ or ```latex...```)
    const blockMathRange = findBlockMathAtCursor(this.view, from);
    if (blockMathRange) {
      this.currentMathRange = blockMathRange;
      this.isBlockMath = true;
      this.showPreview(blockMathRange.content);
      return;
    }

    // Then check for inline math ($...$)
    const inlineMathRange = findInlineMathAtCursor(this.view, from);
    if (inlineMathRange) {
      this.currentMathRange = inlineMathRange;
      this.isBlockMath = false;
      this.showPreview(inlineMathRange.content);
      return;
    }

    this.hidePreview();
  }

  private showPreview(content: string) {
    if (!this.currentMathRange) return;

    const preview = getMathPreviewView();

    // Get coordinates for the math range
    const fromCoords = this.view.coordsAtPos(this.currentMathRange.from);
    const toCoords = this.view.coordsAtPos(this.currentMathRange.to);

    if (!fromCoords || !toCoords) {
      this.hidePreview();
      return;
    }

    let anchorRect: { top: number; left: number; bottom: number; right: number };

    if (this.isBlockMath) {
      // For block math, center horizontally using editor bounds
      const editorRect = this.view.dom.getBoundingClientRect();
      anchorRect = {
        top: Math.min(fromCoords.top, toCoords.top),
        left: editorRect.left,
        bottom: Math.max(fromCoords.bottom, toCoords.bottom),
        right: editorRect.right,
      };
    } else {
      // For inline math, use the actual text coordinates
      anchorRect = {
        top: Math.min(fromCoords.top, toCoords.top),
        left: Math.min(fromCoords.left, toCoords.left),
        bottom: Math.max(fromCoords.bottom, toCoords.bottom),
        right: Math.max(toCoords.right, fromCoords.right),
      };
    }

    if (preview.isVisible()) {
      // Update existing preview
      preview.updateContent(content);
      preview.updatePosition(anchorRect);
    } else {
      // Show new preview
      preview.show(content, anchorRect, this.view.dom);
    }
  }

  private hidePreview() {
    this.currentMathRange = null;
    getMathPreviewView().hide();
  }

  destroy() {
    this.hidePreview();
  }
}

export function createSourceMathPreviewPlugin() {
  return ViewPlugin.fromClass(SourceMathPreviewPlugin);
}
