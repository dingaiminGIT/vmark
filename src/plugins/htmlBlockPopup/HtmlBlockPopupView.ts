/**
 * HTML Block Popup View
 *
 * DOM management for editing raw HTML inline/block nodes.
 */

import type { EditorView } from "@tiptap/pm/view";
import { useHtmlBlockPopupStore } from "@/stores/htmlBlockPopupStore";
import {
  calculatePopupPosition,
  getBoundaryRects,
  getViewportBounds,
  type AnchorRect,
} from "@/utils/popupPosition";
import { isImeKeyEvent } from "@/utils/imeGuard";

const DEFAULT_POPUP_WIDTH = 420;
const DEFAULT_POPUP_HEIGHT = 220;

export class HtmlBlockPopupView {
  private container: HTMLElement;
  private textarea: HTMLTextAreaElement;
  private unsubscribe: () => void;
  private editorView: EditorView;
  private justOpened = false;
  private wasOpen = false;

  constructor(view: EditorView) {
    this.editorView = view;

    this.container = this.buildContainer();
    this.textarea = this.container.querySelector(
      ".html-popup-input"
    ) as HTMLTextAreaElement;
    document.body.appendChild(this.container);

    this.unsubscribe = useHtmlBlockPopupStore.subscribe((state) => {
      if (state.isOpen && state.anchorRect) {
        if (!this.wasOpen) {
          this.show(state.html, state.anchorRect);
        }
        this.wasOpen = true;
      } else {
        this.hide();
        this.wasOpen = false;
      }
    });

    document.addEventListener("mousedown", this.handleClickOutside);
  }

  private buildContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = "html-popup";
    container.style.display = "none";

    const textarea = document.createElement("textarea");
    textarea.className = "html-popup-input";
    textarea.placeholder = "Enter HTML...";
    textarea.rows = 5;
    textarea.addEventListener("input", this.handleInputChange);
    textarea.addEventListener("keydown", this.handleKeydown);

    const warning = document.createElement("div");
    warning.className = "html-popup-warning";
    warning.textContent = "Raw HTML can be unsafe. Ensure it is trusted.";

    const buttons = document.createElement("div");
    buttons.className = "html-popup-buttons";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "html-popup-btn html-popup-btn-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", this.handleCancel);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "html-popup-btn html-popup-btn-save";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", this.handleSave);

    buttons.appendChild(cancelBtn);
    buttons.appendChild(saveBtn);

    container.appendChild(textarea);
    container.appendChild(warning);
    container.appendChild(buttons);

    return container;
  }

  private show(html: string, anchorRect: AnchorRect) {
    this.textarea.value = html;
    this.container.style.display = "flex";
    this.container.style.position = "fixed";

    this.justOpened = true;
    requestAnimationFrame(() => {
      this.justOpened = false;
    });

    const containerEl = this.editorView.dom.closest(
      ".editor-container"
    ) as HTMLElement;
    const bounds = containerEl
      ? getBoundaryRects(this.editorView.dom as HTMLElement, containerEl)
      : getViewportBounds();

    const popupRect = this.container.getBoundingClientRect();
    const { top, left } = calculatePopupPosition({
      anchor: anchorRect,
      popup: {
        width: popupRect.width || DEFAULT_POPUP_WIDTH,
        height: popupRect.height || DEFAULT_POPUP_HEIGHT,
      },
      bounds,
      gap: 8,
      preferAbove: true,
    });

    this.container.style.top = `${top}px`;
    this.container.style.left = `${left}px`;

    requestAnimationFrame(() => {
      this.textarea.focus();
      this.textarea.select();
    });
  }

  private hide() {
    this.container.style.display = "none";
  }

  private handleInputChange = () => {
    useHtmlBlockPopupStore.getState().updateHtml(this.textarea.value);
  };

  private handleKeydown = (e: KeyboardEvent) => {
    if (isImeKeyEvent(e)) return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.handleCancel();
      return;
    }

    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      this.handleSave();
    }
  };

  private handleSave = () => {
    const state = useHtmlBlockPopupStore.getState();
    const { nodePos } = state;
    if (nodePos === null) return;

    const html = this.textarea.value;
    const { state: editorState, dispatch } = this.editorView;
    const node = editorState.doc.nodeAt(nodePos);
    if (!node || (node.type.name !== "html_inline" && node.type.name !== "html_block")) {
      state.closePopup();
      return;
    }

    const tr = editorState.tr.setNodeMarkup(nodePos, undefined, {
      ...node.attrs,
      value: html,
    });

    dispatch(tr);
    state.closePopup();
    this.editorView.focus();
  };

  private handleCancel = () => {
    useHtmlBlockPopupStore.getState().closePopup();
    this.editorView.focus();
  };

  private handleClickOutside = (e: MouseEvent) => {
    if (this.justOpened) return;
    const { isOpen } = useHtmlBlockPopupStore.getState();
    if (!isOpen) return;

    const target = e.target as Node;
    if (!this.container.contains(target)) {
      useHtmlBlockPopupStore.getState().closePopup();
    }
  };

  destroy() {
    this.unsubscribe();
    document.removeEventListener("mousedown", this.handleClickOutside);
    this.container.remove();
  }
}
