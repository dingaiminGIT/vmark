/**
 * Source Mode Image Preview Plugin
 *
 * Shows a floating preview of images when cursor is inside:
 * - Inline image: ![alt](path)
 * - Inline image with title: ![alt](path "title")
 *
 * Reuses the ImagePreviewView singleton from the imagePreview plugin.
 */

import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { getImagePreviewView } from "@/plugins/imagePreview";
import { hasImageExtension } from "@/utils/imagePathDetection";

/**
 * Image markdown range result.
 */
interface ImageRange {
  /** Start position of full image markdown (from ![) */
  from: number;
  /** End position of full image markdown (to ]) */
  to: number;
  /** The image path/URL */
  path: string;
  /** The alt text */
  alt: string;
}

/**
 * Find image markdown at cursor position.
 * Detects: ![alt](path) or ![alt](path "title")
 *
 * Returns null if:
 * - Not inside an image markdown
 * - Path doesn't have image extension (skip non-image links)
 */
function findImageAtCursor(view: EditorView, pos: number): ImageRange | null {
  const doc = view.state.doc;
  const line = doc.lineAt(pos);
  const lineText = line.text;
  const lineStart = line.from;

  // Regex to match ![alt](path) or ![alt](path "title")
  // Captures: [1] = alt, [2] = path (without quotes and title)
  const imageRegex = /!\[([^\]]*)\]\(([^)\s"]+)(?:\s+"[^"]*")?\)/g;

  let match;
  while ((match = imageRegex.exec(lineText)) !== null) {
    const matchStart = lineStart + match.index;
    const matchEnd = matchStart + match[0].length;

    // Check if cursor is inside this image markdown
    if (pos >= matchStart && pos <= matchEnd) {
      const alt = match[1];
      const path = match[2];

      // Only show preview for image extensions (skip regular links)
      if (!hasImageExtension(path) && !path.startsWith("data:image/")) {
        continue;
      }

      return {
        from: matchStart,
        to: matchEnd,
        path,
        alt,
      };
    }
  }

  return null;
}

class SourceImagePreviewPlugin {
  private view: EditorView;
  private currentImageRange: ImageRange | null = null;
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
      this.checkImageAtCursor();
    });
  }

  private checkImageAtCursor() {
    const { from, to } = this.view.state.selection.main;

    // Only show preview for collapsed selection (cursor, not range)
    if (from !== to) {
      this.hidePreview();
      return;
    }

    // Check for image markdown at cursor
    const imageRange = findImageAtCursor(this.view, from);
    if (imageRange) {
      this.currentImageRange = imageRange;
      this.showPreview(imageRange.path);
      return;
    }

    this.hidePreview();
  }

  private showPreview(path: string) {
    if (!this.currentImageRange) return;

    const preview = getImagePreviewView();

    // Get coordinates for the image range
    const fromCoords = this.view.coordsAtPos(this.currentImageRange.from);
    const toCoords = this.view.coordsAtPos(this.currentImageRange.to);

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
      preview.updateContent(path, anchorRect);
    } else {
      // Show new preview
      preview.show(path, anchorRect, this.view.dom);
    }
  }

  private hidePreview() {
    this.currentImageRange = null;
    getImagePreviewView().hide();
  }

  destroy() {
    this.hidePreview();
  }
}

export function createSourceImagePreviewPlugin() {
  return ViewPlugin.fromClass(SourceImagePreviewPlugin);
}
