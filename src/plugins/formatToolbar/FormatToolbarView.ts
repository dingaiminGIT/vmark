/**
 * Format Toolbar View
 *
 * DOM-based floating toolbar for inline formatting in Milkdown.
 * Similar to source mode's format popup, triggered by Cmd+/.
 */

import type { EditorView } from "@milkdown/kit/prose/view";
import { useFormatToolbarStore } from "@/stores/formatToolbarStore";
import { expandedToggleMark } from "@/plugins/editorPlugins";
import {
  calculatePopupPosition,
  getBoundaryRects,
  getViewportBounds,
  type AnchorRect,
} from "@/utils/popupPosition";

// SVG Icons (matching source mode popup)
const icons = {
  bold: `<svg viewBox="0 0 24 24"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>`,
  italic: `<svg viewBox="0 0 24 24"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>`,
  strikethrough: `<svg viewBox="0 0 24 24"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/></svg>`,
  code: `<svg viewBox="0 0 24 24"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>`,
  highlight: `<svg viewBox="0 0 24 24"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`,
  link: `<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  subscript: `<svg viewBox="0 0 24 24"><path d="m4 5 8 8"/><path d="m12 5-8 8"/><path d="M20 19h-4c0-1.5.44-2 1.5-2.5S20 15.33 20 14c0-.47-.17-.93-.48-1.29a2.11 2.11 0 0 0-2.62-.44c-.42.24-.74.62-.9 1.07"/></svg>`,
  superscript: `<svg viewBox="0 0 24 24"><path d="m4 19 8-8"/><path d="m12 19-8-8"/><path d="M20 12h-4c0-1.5.442-2 1.5-2.5S20 8.334 20 7c0-.472-.167-.933-.48-1.29a2.105 2.105 0 0 0-2.617-.436c-.42.239-.738.614-.903 1.06"/></svg>`,
};

// Button definitions with mark types
const FORMAT_BUTTONS = [
  { icon: icons.bold, title: "Bold (⌘B)", markType: "strong" },
  { icon: icons.italic, title: "Italic (⌘I)", markType: "emphasis" },
  { icon: icons.strikethrough, title: "Strikethrough (⌘⇧X)", markType: "strike_through" },
  { icon: icons.code, title: "Inline Code (⌘`)", markType: "inlineCode" },
  { icon: icons.highlight, title: "Highlight", markType: "highlight" },
  { icon: icons.link, title: "Link (⌘K)", markType: "link" },
  { icon: icons.subscript, title: "Subscript", markType: "subscript" },
  { icon: icons.superscript, title: "Superscript", markType: "superscript" },
];

/**
 * Format toolbar view - manages the floating toolbar UI.
 */
export class FormatToolbarView {
  private container: HTMLElement;
  private unsubscribe: () => void;
  private editorView: EditorView;
  private wasOpen = false;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(view: EditorView) {
    this.editorView = view;

    // Build DOM structure
    this.container = this.buildContainer();

    // Append to document body
    document.body.appendChild(this.container);

    // Subscribe to store changes
    this.unsubscribe = useFormatToolbarStore.subscribe((state) => {
      if (state.isOpen && state.anchorRect) {
        // Update editor view reference if changed
        if (state.editorView) {
          this.editorView = state.editorView;
        }
        if (!this.wasOpen) {
          this.show(state.anchorRect);
        } else {
          this.updatePosition(state.anchorRect);
        }
        this.wasOpen = true;
      } else {
        this.hide();
        this.wasOpen = false;
      }
    });
  }

  private getFocusableElements(): HTMLElement[] {
    return Array.from(
      this.container.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  private setupKeyboardNavigation() {
    this.keydownHandler = (e: KeyboardEvent) => {
      // Only handle when toolbar is visible and open
      if (!useFormatToolbarStore.getState().isOpen) return;
      if (this.container.style.display === "none") return;

      // Check if focus is inside toolbar for keyboard nav
      const activeEl = document.activeElement as HTMLElement;
      const focusInToolbar = this.container.contains(activeEl);

      // Close on Escape (always, regardless of focus)
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        useFormatToolbarStore.getState().closeToolbar();
        this.editorView.focus();
        return;
      }

      // Toggle on Cmd+E only if focus is inside toolbar
      if (focusInToolbar && (e.key === "e" || e.key === "E") && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        useFormatToolbarStore.getState().closeToolbar();
        this.editorView.focus();
        return;
      }

      // Tab navigation only if focus is inside toolbar
      if (focusInToolbar && e.key === "Tab") {
        const focusable = this.getFocusableElements();
        if (focusable.length === 0) return;

        const currentIndex = focusable.indexOf(activeEl);
        if (currentIndex === -1) return;

        e.preventDefault();

        if (e.shiftKey) {
          const prevIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
          focusable[prevIndex].focus();
        } else {
          const nextIndex = currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1;
          focusable[nextIndex].focus();
        }
      }
    };

    document.addEventListener("keydown", this.keydownHandler);
  }

  private removeKeyboardNavigation() {
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
  }

  private buildContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = "format-toolbar";
    container.style.display = "none";

    const row = document.createElement("div");
    row.className = "format-toolbar-row";

    for (const btn of FORMAT_BUTTONS) {
      row.appendChild(this.buildButton(btn.icon, btn.title, btn.markType));
    }

    container.appendChild(row);
    return container;
  }

  private buildButton(
    iconSvg: string,
    title: string,
    markType: string
  ): HTMLElement {
    const btn = document.createElement("button");
    btn.className = "format-toolbar-btn";
    btn.type = "button";
    btn.title = title;
    btn.innerHTML = iconSvg;

    // Prevent mousedown from stealing focus
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleFormat(markType);
    });

    return btn;
  }

  private handleFormat(markType: string) {
    this.editorView.focus();
    expandedToggleMark(this.editorView, markType);
    // Close toolbar after action
    useFormatToolbarStore.getState().closeToolbar();
  }

  private show(anchorRect: AnchorRect) {
    this.container.style.display = "flex";
    this.container.style.position = "fixed";
    this.updatePosition(anchorRect);

    // Set up keyboard navigation
    this.setupKeyboardNavigation();

    // Focus first button after a short delay
    setTimeout(() => {
      const focusable = this.getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }, 50);
  }

  private updatePosition(anchorRect: AnchorRect) {
    // Get boundaries
    const containerEl = this.editorView.dom.closest(".editor-container") as HTMLElement;
    const bounds = containerEl
      ? getBoundaryRects(this.editorView.dom as HTMLElement, containerEl)
      : getViewportBounds();

    // Measure toolbar
    const toolbarWidth = this.container.offsetWidth || 280;
    const toolbarHeight = this.container.offsetHeight || 36;

    // Calculate position - prefer above the cursor
    const { top, left } = calculatePopupPosition({
      anchor: anchorRect,
      popup: { width: toolbarWidth, height: toolbarHeight },
      bounds,
      gap: 8,
      preferAbove: true,
    });

    this.container.style.top = `${top}px`;
    this.container.style.left = `${left}px`;
  }

  private hide() {
    this.container.style.display = "none";
    this.removeKeyboardNavigation();
  }

  destroy() {
    this.unsubscribe();
    this.removeKeyboardNavigation();
    this.container.remove();
  }
}
