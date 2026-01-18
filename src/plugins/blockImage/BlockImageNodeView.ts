import { convertFileSrc } from "@tauri-apps/api/core";
import { dirname, join } from "@tauri-apps/api/path";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { NodeView } from "@tiptap/pm/view";
import { useDocumentStore } from "@/stores/documentStore";
import { useTabStore } from "@/stores/tabStore";
import { useImageContextMenuStore } from "@/stores/imageContextMenuStore";
import { useImagePopupStore } from "@/stores/imagePopupStore";
import { getWindowLabel } from "@/hooks/useWindowFocus";
import { isAbsolutePath, isExternalUrl, isRelativePath, validateImagePath } from "@/plugins/imageView/security";

function getActiveTabIdForCurrentWindow(): string | null {
  try {
    const windowLabel = getWindowLabel();
    return useTabStore.getState().activeTabId[windowLabel] ?? null;
  } catch {
    return null;
  }
}

async function resolveImageSrc(src: string): Promise<string> {
  if (isExternalUrl(src)) return src;
  if (isAbsolutePath(src)) return convertFileSrc(src);

  if (isRelativePath(src)) {
    if (!validateImagePath(src)) {
      console.warn("[BlockImageView] Rejected invalid image path:", src);
      return "";
    }

    const tabId = getActiveTabIdForCurrentWindow();
    const doc = tabId ? useDocumentStore.getState().getDocument(tabId) : undefined;
    const filePath = doc?.filePath;
    if (!filePath) return src;

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

  return src;
}

export class BlockImageNodeView implements NodeView {
  dom: HTMLElement;
  private img: HTMLImageElement;
  private originalSrc: string;
  private getPos: () => number | undefined;
  private resolveRequestId = 0;
  private destroyed = false;
  // Store active load handlers for cleanup
  private activeLoadHandler: (() => void) | null = null;
  private activeErrorHandler: (() => void) | null = null;

  constructor(node: PMNode, getPos: () => number | undefined) {
    this.getPos = getPos;
    this.originalSrc = String(node.attrs.src ?? "");

    this.dom = document.createElement("figure");
    this.dom.className = "block-image";
    this.dom.setAttribute("data-type", "block_image");

    this.img = document.createElement("img");
    this.img.alt = String(node.attrs.alt ?? "");
    this.img.title = String(node.attrs.title ?? "");

    this.updateSrc(this.originalSrc);

    this.img.addEventListener("contextmenu", this.handleContextMenu);
    this.img.addEventListener("click", this.handleClick);

    this.dom.appendChild(this.img);
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
    const rect = this.img.getBoundingClientRect();
    useImagePopupStore.getState().openPopup({
      imageSrc: this.originalSrc,
      imageAlt: this.img.alt ?? "",
      imageNodePos: pos,
      imageNodeType: "block_image",
      anchorRect: {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
      },
    });
  };

  private updateSrc(src: string): void {
    // Reset states
    this.img.style.opacity = "1";
    this.dom.classList.remove("image-loading", "image-error");
    this.img.removeAttribute("title");

    if (!src) {
      this.img.src = "";
      this.showError("No image source");
      return;
    }

    if (isExternalUrl(src)) {
      this.dom.classList.add("image-loading");
      this.img.src = src;
      this.setupLoadHandlers();
      return;
    }

    this.img.src = "";
    this.dom.classList.add("image-loading");

    const requestId = ++this.resolveRequestId;

    resolveImageSrc(src).then((resolvedSrc) => {
      if (this.destroyed || requestId !== this.resolveRequestId) return;
      if (!resolvedSrc) {
        this.showError("Failed to resolve path");
        return;
      }
      this.img.src = resolvedSrc;
      this.setupLoadHandlers();
    });
  }

  private cleanupLoadHandlers(): void {
    if (this.activeLoadHandler) {
      this.img.removeEventListener("load", this.activeLoadHandler);
      this.activeLoadHandler = null;
    }
    if (this.activeErrorHandler) {
      this.img.removeEventListener("error", this.activeErrorHandler);
      this.activeErrorHandler = null;
    }
  }

  private setupLoadHandlers(): void {
    // Clean up any existing handlers first
    this.cleanupLoadHandlers();

    const onLoad = () => {
      if (this.destroyed) return;
      this.dom.classList.remove("image-loading", "image-error");
      this.img.style.opacity = "1";
      this.cleanupLoadHandlers();
    };

    const onError = () => {
      if (this.destroyed) return;
      this.showError("Failed to load image");
      this.cleanupLoadHandlers();
    };

    this.activeLoadHandler = onLoad;
    this.activeErrorHandler = onError;
    this.img.addEventListener("load", onLoad);
    this.img.addEventListener("error", onError);
  }

  private showError(message: string): void {
    this.dom.classList.remove("image-loading");
    this.dom.classList.add("image-error");
    this.img.style.opacity = "0.5";
    // Store original title and set error tooltip
    if (!this.img.hasAttribute("data-original-title") && this.img.title) {
      this.img.setAttribute("data-original-title", this.img.title);
    }
    this.img.title = `${message}: ${this.originalSrc}`;
  }

  update(node: PMNode): boolean {
    if (node.type.name !== "block_image") return false;

    this.img.alt = String(node.attrs.alt ?? "");
    this.img.title = String(node.attrs.title ?? "");

    const newSrc = String(node.attrs.src ?? "");
    if (this.originalSrc !== newSrc) {
      this.originalSrc = newSrc;
      this.updateSrc(newSrc);
    }

    return true;
  }

  destroy(): void {
    this.destroyed = true;
    this.cleanupLoadHandlers();
    this.img.removeEventListener("contextmenu", this.handleContextMenu);
    this.img.removeEventListener("click", this.handleClick);
  }

  stopEvent(event: Event): boolean {
    if (event.type === "mousedown" || event.type === "click") {
      return (event.target as HTMLElement) === this.img;
    }
    return false;
  }
}
