/**
 * Wiki Embed Popup View
 *
 * DOM management for editing wiki embed target.
 */

import type { EditorView } from "@tiptap/pm/view";
import { useWikiEmbedPopupStore } from "@/stores/wikiEmbedPopupStore";
import {
  calculatePopupPosition,
  getBoundaryRects,
  getViewportBounds,
  type AnchorRect,
} from "@/utils/popupPosition";
import { isImeKeyEvent } from "@/utils/imeGuard";

const DEFAULT_POPUP_WIDTH = 300;
const DEFAULT_POPUP_HEIGHT = 100;

export class WikiEmbedPopupView {
  private container: HTMLElement;
  private targetInput: HTMLInputElement;
  private preview: HTMLElement;
  private unsubscribe: () => void;
  private editorView: EditorView;
  private justOpened = false;
  private wasOpen = false;

  constructor(view: EditorView) {
    this.editorView = view;

    this.container = this.buildContainer();
    this.targetInput = this.container.querySelector(
      ".wiki-embed-popup-target"
    ) as HTMLInputElement;
    this.preview = this.container.querySelector(
      ".wiki-embed-popup-preview"
    ) as HTMLElement;
    document.body.appendChild(this.container);

    this.unsubscribe = useWikiEmbedPopupStore.subscribe((state) => {
      if (state.isOpen && state.anchorRect) {
        if (!this.wasOpen) {
          this.show(state.target, state.anchorRect);
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
    container.className = "wiki-embed-popup";
    container.style.display = "none";

    const targetInput = document.createElement("input");
    targetInput.className = "wiki-embed-popup-target";
    targetInput.placeholder = "Embed target";
    targetInput.addEventListener("input", this.handleTargetChange);
    targetInput.addEventListener("keydown", this.handleKeydown);

    const preview = document.createElement("div");
    preview.className = "wiki-embed-popup-preview";

    const buttons = document.createElement("div");
    buttons.className = "wiki-embed-popup-buttons";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "wiki-embed-popup-btn wiki-embed-popup-btn-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", this.handleCancel);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "wiki-embed-popup-btn wiki-embed-popup-btn-save";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", this.handleSave);

    buttons.appendChild(cancelBtn);
    buttons.appendChild(saveBtn);

    container.appendChild(targetInput);
    container.appendChild(preview);
    container.appendChild(buttons);

    return container;
  }

  private show(target: string, anchorRect: AnchorRect) {
    this.targetInput.value = target;
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
      gap: 6,
      preferAbove: true,
    });

    this.container.style.top = `${top}px`;
    this.container.style.left = `${left}px`;

    this.updatePreview(target);

    requestAnimationFrame(() => {
      this.targetInput.focus();
      this.targetInput.select();
    });
  }

  private hide() {
    this.container.style.display = "none";
  }

  private updatePreview(target: string) {
    const trimmed = target.trim();
    this.preview.textContent = trimmed ? `![[${trimmed}]]` : "";
  }

  private handleTargetChange = () => {
    const target = this.targetInput.value;
    useWikiEmbedPopupStore.getState().updateTarget(target);
    this.updatePreview(target);
  };

  private handleKeydown = (e: KeyboardEvent) => {
    if (isImeKeyEvent(e)) return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.handleCancel();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.handleSave();
    }
  };

  private handleSave = () => {
    const state = useWikiEmbedPopupStore.getState();
    const { nodePos } = state;
    const target = this.targetInput.value.trim();

    if (!target || nodePos === null) {
      state.closePopup();
      return;
    }

    const { state: editorState, dispatch } = this.editorView;
    const node = editorState.doc.nodeAt(nodePos);
    if (!node || node.type.name !== "wikiEmbed") {
      state.closePopup();
      return;
    }

    const attrs = {
      ...node.attrs,
      value: target,
    };
    const tr = editorState.tr.setNodeMarkup(nodePos, undefined, attrs);
    dispatch(tr);

    state.closePopup();
    this.editorView.focus();
  };

  private handleCancel = () => {
    useWikiEmbedPopupStore.getState().closePopup();
    this.editorView.focus();
  };

  private handleClickOutside = (e: MouseEvent) => {
    if (this.justOpened) return;
    const { isOpen } = useWikiEmbedPopupStore.getState();
    if (!isOpen) return;

    const target = e.target as Node;
    if (!this.container.contains(target)) {
      useWikiEmbedPopupStore.getState().closePopup();
    }
  };

  destroy() {
    this.unsubscribe();
    document.removeEventListener("mousedown", this.handleClickOutside);
    this.container.remove();
  }
}
