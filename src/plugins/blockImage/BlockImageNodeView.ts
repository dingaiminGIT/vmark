import { convertFileSrc } from "@tauri-apps/api/core";
import { dirname, join } from "@tauri-apps/api/path";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { NodeView } from "@tiptap/pm/view";
import { useDocumentStore } from "@/stores/documentStore";
import { useTabStore } from "@/stores/tabStore";
import { useImageContextMenuStore } from "@/stores/imageContextMenuStore";
import { useImagePopupStore } from "@/stores/imagePopupStore";
import { getWindowLabel } from "@/utils/windowFocus";
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
    this.img.style.opacity = "1";

    if (!src) {
      this.img.src = "";
      return;
    }

    if (isExternalUrl(src)) {
      this.img.src = src;
      return;
    }

    this.img.src = "";
    this.img.style.opacity = "0.5";

    const requestId = ++this.resolveRequestId;

    resolveImageSrc(src).then((resolvedSrc) => {
      if (this.destroyed || requestId !== this.resolveRequestId) return;
      this.img.src = resolvedSrc;
      this.img.style.opacity = "1";
    });
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
