/**
 * Image View Plugin
 *
 * Transforms relative image paths to asset:// URLs for rendering,
 * while keeping relative paths in the document (for portability).
 */

import { convertFileSrc } from "@tauri-apps/api/core";
import { dirname, join } from "@tauri-apps/api/path";
import type { NodeView } from "@tiptap/pm/view";
import type { Node } from "@tiptap/pm/model";
import { useDocumentStore } from "@/stores/documentStore";
import { useTabStore } from "@/stores/tabStore";
import { useImageContextMenuStore } from "@/stores/imageContextMenuStore";
import { useImagePopupStore } from "@/stores/imagePopupStore";
import { getWindowLabel } from "@/utils/windowFocus";
import { isRelativePath, isAbsolutePath, isExternalUrl, validateImagePath } from "./security";

function getActiveTabIdForCurrentWindow(): string | null {
  try {
    const windowLabel = getWindowLabel();
    return useTabStore.getState().activeTabId[windowLabel] ?? null;
  } catch {
    return null;
  }
}

/**
 * Convert image path to asset URL for webview rendering.
 * Handles: relative paths, absolute paths, and external URLs.
 */
async function resolveImageSrc(src: string): Promise<string> {
  // External URLs (http/https/data) - use directly
  if (isExternalUrl(src)) {
    return src;
  }

  // Absolute local paths - convert to asset:// URL
  if (isAbsolutePath(src)) {
    return convertFileSrc(src);
  }

  // Relative paths - resolve against document directory
  if (isRelativePath(src)) {
    // Validate path to prevent traversal attacks
    if (!validateImagePath(src)) {
      console.warn("[ImageView] Rejected invalid image path:", src);
      return "";
    }

    const tabId = getActiveTabIdForCurrentWindow();
    const doc = tabId ? useDocumentStore.getState().getDocument(tabId) : undefined;
    const filePath = doc?.filePath;
    if (!filePath) {
      return src; // No document path, can't resolve
    }

    try {
      const docDir = await dirname(filePath);
      const cleanPath = src.replace(/^\.\//, "");
      const absolutePath = await join(docDir, cleanPath);
      return convertFileSrc(absolutePath);
    } catch (error) {
      console.error("Failed to resolve image path:", error);
      return src;
    }
  }

  // Unknown format - return as-is
  return src;
}

/**
 * Custom NodeView for image nodes.
 * Renders images with resolved asset URLs while keeping relative paths in the document.
 */
export class ImageNodeView implements NodeView {
  dom: HTMLImageElement;
  private originalSrc: string;
  private getPos: () => number | undefined;
  private resolveRequestId = 0; // Track async requests to ignore stale responses
  private destroyed = false;

  constructor(node: Node, getPos: () => number | undefined) {
    this.getPos = getPos;
    this.originalSrc = node.attrs.src ?? "";

    // Create img element directly as dom (no wrapper)
    // This simplifies DOM structure and helps with selection behavior
    this.dom = document.createElement("img");
    this.dom.className = "inline-image";
    this.dom.alt = node.attrs.alt ?? "";
    this.dom.title = node.attrs.title ?? "";

    // Set initial src and resolve if needed
    this.updateSrc(this.originalSrc);

    // Add context menu handler
    this.dom.addEventListener("contextmenu", this.handleContextMenu);

    // Add click handler for popup
    this.dom.addEventListener("click", this.handleClick);
  }

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const pos = this.getPos();
    if (pos === undefined) return;

    useImageContextMenuStore.getState().openMenu({
      position: { x: e.clientX, y: e.clientY },
      imageSrc: this.originalSrc,
      imageNodePos: pos,
    });
  };

  private handleClick = (_e: MouseEvent) => {
    const pos = this.getPos();
    if (pos === undefined) return;

    const rect = this.dom.getBoundingClientRect();
    useImagePopupStore.getState().openPopup({
      imageSrc: this.originalSrc,
      imageAlt: this.dom.alt ?? "",
      imageNodePos: pos,
      anchorRect: {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
      },
    });
  };

  private updateSrc(src: string): void {
    // Always reset opacity first
    this.dom.style.opacity = "1";

    if (!src) {
      this.dom.src = "";
      return;
    }

    // External URLs can be used directly
    if (isExternalUrl(src)) {
      this.dom.src = src;
      return;
    }

    // Relative and absolute paths need resolution
    // Show placeholder while resolving
    this.dom.src = "";
    this.dom.style.opacity = "0.5";

    // Increment request ID to track this specific request
    const requestId = ++this.resolveRequestId;

    resolveImageSrc(src).then((resolvedSrc) => {
      // Ignore stale responses (src changed or view destroyed)
      if (this.destroyed || requestId !== this.resolveRequestId) {
        return;
      }
      this.dom.src = resolvedSrc;
      this.dom.style.opacity = "1";
    });
  }

  update(node: Node): boolean {
    if (node.type.name !== "image") {
      return false;
    }

    this.dom.alt = node.attrs.alt ?? "";
    this.dom.title = node.attrs.title ?? "";

    const newSrc = node.attrs.src ?? "";
    if (this.originalSrc !== newSrc) {
      this.originalSrc = newSrc;
      this.updateSrc(newSrc);
    }

    return true;
  }

  destroy(): void {
    this.destroyed = true;
    this.dom.removeEventListener("contextmenu", this.handleContextMenu);
    this.dom.removeEventListener("click", this.handleClick);
  }

  /**
   * Prevent ProseMirror from handling mouse events on the image.
   * This stops the selection from expanding when clicking on images.
   */
  stopEvent(event: Event): boolean {
    // Stop mousedown/click to prevent text selection
    if (event.type === "mousedown" || event.type === "click") {
      return true;
    }
    return false;
  }

  /**
   * Called when this node is selected via NodeSelection.
   * Add visual selection indicator.
   */
  selectNode(): void {
    this.dom.classList.add("ProseMirror-selectednode");
    // Fix browser selection quirk: clear native selection to prevent
    // visual artifacts where text before image appears selected
    requestAnimationFrame(() => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        // Only clear if selection intersects this image (NodeSelection artifact)
        const range = sel.getRangeAt(0);
        if (range.intersectsNode(this.dom)) {
          sel.removeAllRanges();
        }
      }
    });
  }

  /**
   * Called when this node is deselected.
   * Remove visual selection indicator.
   */
  deselectNode(): void {
    this.dom.classList.remove("ProseMirror-selectednode");
  }
}
