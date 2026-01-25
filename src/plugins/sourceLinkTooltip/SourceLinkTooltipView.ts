/**
 * Source Link Tooltip View
 *
 * Read-only tooltip showing URL + visit button on hover in Source mode.
 * Does NOT allow editing - use Cmd+K for that.
 */

import type { EditorView } from "@codemirror/view";
import { useLinkTooltipStore } from "@/stores/linkTooltipStore";
import {
  calculatePopupPosition,
  getBoundaryRects,
  getViewportBounds,
  type AnchorRect,
} from "@/utils/popupPosition";
import { isImeKeyEvent } from "@/utils/imeGuard";
import { truncateUrl } from "@/utils/urlDetection";
import { getPopupHostForDom, toHostCoordsForDom } from "@/plugins/sourcePopup";

// SVG Icon for visit/open
const visitIcon = `<svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

/**
 * Source link tooltip view - manages the floating tooltip UI.
 */
export class SourceLinkTooltipView {
  private container: HTMLElement;
  private urlSpan: HTMLElement;
  private visitBtn: HTMLElement;
  private unsubscribe: () => void;
  private editorView: EditorView;
  private host: HTMLElement | null = null;
  private escHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(view: EditorView) {
    this.editorView = view;

    // Build DOM structure
    this.container = this.buildContainer();
    this.urlSpan = this.container.querySelector(".link-tooltip-url") as HTMLElement;
    this.visitBtn = this.container.querySelector(".link-tooltip-btn") as HTMLElement;

    // Subscribe to store changes
    this.unsubscribe = useLinkTooltipStore.subscribe((state) => {
      if (state.isOpen && state.anchorRect) {
        this.show(state.href, state.anchorRect);
      } else {
        this.hide();
      }
    });

    // Handle mouse leaving the tooltip
    this.container.addEventListener("mouseleave", this.handleMouseLeave);

    // Close tooltip on scroll
    this.editorView.dom
      .closest(".editor-container")
      ?.addEventListener("scroll", this.handleScroll, true);
  }

  private buildContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = "link-tooltip";
    container.style.display = "none";

    // URL display (read-only)
    const urlSpan = document.createElement("span");
    urlSpan.className = "link-tooltip-url";
    container.appendChild(urlSpan);

    // Visit button
    const visitBtn = document.createElement("button");
    visitBtn.className = "link-tooltip-btn";
    visitBtn.type = "button";
    visitBtn.title = "Open link";
    visitBtn.innerHTML = visitIcon;
    visitBtn.addEventListener("click", this.handleVisit);
    container.appendChild(visitBtn);

    return container;
  }

  private show(href: string, anchorRect: AnchorRect) {
    const isBookmark = href.startsWith("#");

    // Update content
    this.urlSpan.textContent = truncateUrl(href);
    this.urlSpan.title = href; // Full URL on hover
    this.visitBtn.title = isBookmark ? "Go to heading" : "Open link";

    // Mount to editor container if available
    this.host = getPopupHostForDom(this.editorView.dom) ?? document.body;
    if (this.container.parentElement !== this.host) {
      this.container.style.position = this.host === document.body ? "fixed" : "absolute";
      this.host.appendChild(this.container);
    }

    this.container.style.display = "flex";

    // Get boundaries
    const containerEl = this.editorView.dom.closest(".editor-container") as HTMLElement;
    const bounds = containerEl
      ? getBoundaryRects(this.editorView.dom as HTMLElement, containerEl)
      : getViewportBounds();

    // Calculate position
    const { top, left } = calculatePopupPosition({
      anchor: anchorRect,
      popup: { width: 300, height: 30 },
      bounds,
      gap: 4,
      preferAbove: true,
    });

    // Convert to host-relative coordinates if needed
    if (this.host !== document.body) {
      const hostPos = toHostCoordsForDom(this.host, { top, left });
      this.container.style.top = `${hostPos.top}px`;
      this.container.style.left = `${hostPos.left}px`;
    } else {
      this.container.style.top = `${top}px`;
      this.container.style.left = `${left}px`;
    }

    // Set up Esc handler
    this.setupEscHandler();
  }

  private hide() {
    this.container.style.display = "none";
    this.host = null;
    this.removeEscHandler();
  }

  private setupEscHandler() {
    if (this.escHandler) return;

    this.escHandler = (e: KeyboardEvent) => {
      if (isImeKeyEvent(e)) return;
      if (e.key === "Escape") {
        useLinkTooltipStore.getState().hideTooltip();
      }
    };
    document.addEventListener("keydown", this.escHandler);
  }

  private removeEscHandler() {
    if (this.escHandler) {
      document.removeEventListener("keydown", this.escHandler);
      this.escHandler = null;
    }
  }

  private handleVisit = () => {
    const { href } = useLinkTooltipStore.getState();
    if (!href) return;

    // Handle bookmark links - for source mode, just close tooltip
    // (Navigation to heading would require access to Tiptap editor)
    if (href.startsWith("#")) {
      useLinkTooltipStore.getState().hideTooltip();
      return;
    }

    // External link - open in browser
    import("@tauri-apps/plugin-opener").then(({ openUrl }) => {
      openUrl(href).catch((error: unknown) => {
        console.error("Failed to open link:", error);
      });
    });

    useLinkTooltipStore.getState().hideTooltip();
  };

  private handleMouseLeave = (e: MouseEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;

    // If moving back to the editor, let hover handler take over
    if (relatedTarget && this.editorView.dom.contains(relatedTarget)) {
      return;
    }

    // Close the tooltip
    useLinkTooltipStore.getState().hideTooltip();
  };

  private handleScroll = () => {
    const { isOpen } = useLinkTooltipStore.getState();
    if (isOpen) {
      useLinkTooltipStore.getState().hideTooltip();
    }
  };

  destroy() {
    this.unsubscribe();
    this.removeEscHandler();
    this.container.removeEventListener("mouseleave", this.handleMouseLeave);
    this.editorView.dom
      .closest(".editor-container")
      ?.removeEventListener("scroll", this.handleScroll, true);
    this.container.remove();
  }
}
