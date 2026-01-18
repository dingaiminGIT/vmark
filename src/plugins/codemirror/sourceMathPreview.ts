/**
 * Source Mode Math Preview Plugin
 *
 * Shows a floating preview of inline math when cursor is inside $...$.
 * Reuses the MathPreviewView singleton from the latex plugin.
 */

import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { getMathPreviewView } from "@/plugins/mathPreview/MathPreviewView";
import { findInlineMathAtCursor } from "@/plugins/toolbarActions/sourceAdapterLinks";

class SourceMathPreviewPlugin {
  private view: EditorView;
  private currentMathRange: { from: number; to: number; content: string } | null = null;
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

    const mathRange = findInlineMathAtCursor(this.view, from);

    if (mathRange) {
      this.currentMathRange = mathRange;
      this.showPreview(mathRange.content);
    } else {
      this.hidePreview();
    }
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

    const anchorRect = {
      top: Math.min(fromCoords.top, toCoords.top),
      left: Math.min(fromCoords.left, toCoords.left),
      bottom: Math.max(fromCoords.bottom, toCoords.bottom),
      right: Math.max(toCoords.right, fromCoords.right),
    };

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
