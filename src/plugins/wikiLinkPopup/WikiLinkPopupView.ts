/**
 * Wiki Link Popup View
 *
 * DOM management for editing wiki link target and alias.
 */

import type { EditorView } from "@tiptap/pm/view";
import { useWikiLinkPopupStore } from "@/stores/wikiLinkPopupStore";
import {
  calculatePopupPosition,
  getBoundaryRects,
  getViewportBounds,
  type AnchorRect,
} from "@/utils/popupPosition";
import { isImeKeyEvent } from "@/utils/imeGuard";

const DEFAULT_POPUP_WIDTH = 320;
const DEFAULT_POPUP_HEIGHT = 120;

export class WikiLinkPopupView {
  private container: HTMLElement;
  private targetInput: HTMLInputElement;
  private aliasInput: HTMLInputElement;
  private preview: HTMLElement;
  private unsubscribe: () => void;
  private editorView: EditorView;
  private justOpened = false;
  private wasOpen = false;

  constructor(view: EditorView) {
    this.editorView = view;

    this.container = this.buildContainer();
    this.targetInput = this.container.querySelector(
      ".wiki-link-popup-target"
    ) as HTMLInputElement;
    this.aliasInput = this.container.querySelector(
      ".wiki-link-popup-alias"
    ) as HTMLInputElement;
    this.preview = this.container.querySelector(
      ".wiki-link-popup-preview"
    ) as HTMLElement;
    document.body.appendChild(this.container);

    this.unsubscribe = useWikiLinkPopupStore.subscribe((state) => {
      if (state.isOpen && state.anchorRect) {
        if (!this.wasOpen) {
          this.show(state.target, state.alias, state.anchorRect);
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
    container.className = "wiki-link-popup";
    container.style.display = "none";

    const targetInput = document.createElement("input");
    targetInput.className = "wiki-link-popup-target";
    targetInput.placeholder = "Target page";
    targetInput.addEventListener("input", this.handleTargetChange);
    targetInput.addEventListener("keydown", this.handleKeydown);

    const aliasInput = document.createElement("input");
    aliasInput.className = "wiki-link-popup-alias";
    aliasInput.placeholder = "Alias (optional)";
    aliasInput.addEventListener("input", this.handleAliasChange);
    aliasInput.addEventListener("keydown", this.handleKeydown);

    const preview = document.createElement("div");
    preview.className = "wiki-link-popup-preview";

    const buttons = document.createElement("div");
    buttons.className = "wiki-link-popup-buttons";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "wiki-link-popup-btn wiki-link-popup-btn-cancel";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", this.handleCancel);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "wiki-link-popup-btn wiki-link-popup-btn-save";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", this.handleSave);

    buttons.appendChild(cancelBtn);
    buttons.appendChild(saveBtn);

    container.appendChild(targetInput);
    container.appendChild(aliasInput);
    container.appendChild(preview);
    container.appendChild(buttons);

    return container;
  }

  private show(target: string, alias: string, anchorRect: AnchorRect) {
    this.targetInput.value = target;
    this.aliasInput.value = alias;
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

    this.updatePreview(target, alias);

    requestAnimationFrame(() => {
      this.targetInput.focus();
      this.targetInput.select();
    });
  }

  private hide() {
    this.container.style.display = "none";
  }

  private updatePreview(target: string, alias: string) {
    const trimmedTarget = target.trim();
    const trimmedAlias = alias.trim();
    if (!trimmedTarget) {
      this.preview.textContent = "";
      return;
    }
    this.preview.textContent = trimmedAlias
      ? `[[${trimmedTarget}|${trimmedAlias}]]`
      : `[[${trimmedTarget}]]`;
  }

  private handleTargetChange = () => {
    const target = this.targetInput.value;
    useWikiLinkPopupStore.getState().updateTarget(target);
    this.updatePreview(target, this.aliasInput.value);
  };

  private handleAliasChange = () => {
    const alias = this.aliasInput.value;
    useWikiLinkPopupStore.getState().updateAlias(alias);
    this.updatePreview(this.targetInput.value, alias);
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
    const state = useWikiLinkPopupStore.getState();
    const { nodePos } = state;
    const target = this.targetInput.value.trim();
    const alias = this.aliasInput.value.trim();

    if (!target || nodePos === null) {
      state.closePopup();
      return;
    }

    const { state: editorState, dispatch } = this.editorView;
    const node = editorState.doc.nodeAt(nodePos);
    if (!node || node.type.name !== "wikiLink") {
      state.closePopup();
      return;
    }

    const attrs = {
      ...node.attrs,
      value: target,
      alias: alias || null,
    };
    const tr = editorState.tr.setNodeMarkup(nodePos, undefined, attrs);
    dispatch(tr);

    state.closePopup();
    this.editorView.focus();
  };

  private handleCancel = () => {
    useWikiLinkPopupStore.getState().closePopup();
    this.editorView.focus();
  };

  private handleClickOutside = (e: MouseEvent) => {
    if (this.justOpened) return;
    const { isOpen } = useWikiLinkPopupStore.getState();
    if (!isOpen) return;

    const target = e.target as Node;
    if (!this.container.contains(target)) {
      useWikiLinkPopupStore.getState().closePopup();
    }
  };

  destroy() {
    this.unsubscribe();
    document.removeEventListener("mousedown", this.handleClickOutside);
    this.container.remove();
  }
}
