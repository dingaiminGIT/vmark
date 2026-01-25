/**
 * WYSIWYG Popup View Base Class
 *
 * Abstract base class for popup views in WYSIWYG mode (TipTap/ProseMirror).
 * Provides common functionality: DOM lifecycle, store subscription,
 * keyboard navigation, click-outside handling, and positioning.
 *
 * Mirrors SourcePopupView for consistency across editor modes.
 */

import type { AnchorRect } from "@/utils/popupPosition";
import {
  calculatePopupPosition,
  getBoundaryRects,
  getViewportBounds,
} from "@/utils/popupPosition";
import { handlePopupTabNavigation } from "@/utils/popupComponents";
import { getPopupHostForDom, toHostCoordsForDom } from "@/plugins/sourcePopup";
import { isImeKeyEvent } from "@/utils/imeGuard";
import type {
  EditorViewLike,
  PopupStoreBase,
  StoreApi,
  PopupPositionConfig,
} from "./types";

// Re-export types for convenience
export type { EditorViewLike, PopupStoreBase, StoreApi, PopupPositionConfig };

/**
 * Abstract base class for WYSIWYG mode popup views.
 *
 * Subclasses must implement:
 * - buildContainer(): Create the popup DOM structure
 * - onShow(): Called when popup becomes visible
 * - onHide(): Called when popup is hidden
 *
 * @template TState - The store state type
 */
export abstract class WysiwygPopupView<TState extends PopupStoreBase> {
  protected container: HTMLElement;
  protected editorView: EditorViewLike;
  protected store: StoreApi<TState>;
  protected unsubscribe: () => void;

  private wasOpen = false;
  private justOpened = false;
  private host: HTMLElement | null = null;

  private boundHandleClickOutside: (e: MouseEvent) => void;
  private boundHandleKeydown: (e: KeyboardEvent) => void;
  private boundHandleScroll: () => void;

  constructor(view: EditorViewLike, store: StoreApi<TState>) {
    this.editorView = view;
    this.store = store;

    this.container = this.buildContainer();
    this.container.style.display = "none";

    this.boundHandleClickOutside = this.handleClickOutside.bind(this);
    this.boundHandleKeydown = this.handleKeydown.bind(this);
    this.boundHandleScroll = this.handleScroll.bind(this);

    this.unsubscribe = store.subscribe((state) => {
      const { isOpen, anchorRect } = this.extractState(state);

      if (isOpen && anchorRect) {
        if (!this.wasOpen) {
          this.show(anchorRect, state);
        }
        this.wasOpen = true;
      } else {
        if (this.wasOpen) {
          this.hide();
        }
        this.wasOpen = false;
      }
    });
  }

  /** Build the popup DOM container. */
  protected abstract buildContainer(): HTMLElement;

  /** Called when popup becomes visible. */
  protected abstract onShow(state: TState): void;

  /** Called when popup is hidden. */
  protected abstract onHide(): void;

  /** Extract isOpen and anchorRect from store state. */
  protected extractState(state: TState): { isOpen: boolean; anchorRect: AnchorRect | null } {
    return { isOpen: state.isOpen, anchorRect: state.anchorRect };
  }

  /** Get popup dimensions for positioning. */
  protected getPopupDimensions(): PopupPositionConfig {
    return { width: 320, height: 40, gap: 6, preferAbove: true };
  }

  /** Get first focusable element for initial focus. */
  protected getFirstFocusable(): HTMLElement | null {
    return this.container.querySelector<HTMLElement>(
      'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
  }

  private show(anchorRect: AnchorRect, state: TState): void {
    this.host = getPopupHostForDom(this.editorView.dom) ?? document.body;
    if (this.container.parentElement !== this.host) {
      this.container.style.position = this.host === document.body ? "fixed" : "absolute";
      this.host.appendChild(this.container);
    }

    this.container.style.display = "flex";

    this.justOpened = true;
    requestAnimationFrame(() => {
      this.justOpened = false;
    });

    this.updatePosition(anchorRect);

    document.addEventListener("mousedown", this.boundHandleClickOutside);
    document.addEventListener("keydown", this.boundHandleKeydown);
    this.editorView.dom.closest(".editor-container")?.addEventListener(
      "scroll",
      this.boundHandleScroll,
      true
    );
    this.container.addEventListener("keydown", this.handleTabNavigation);

    this.onShow(state);

    requestAnimationFrame(() => {
      const firstFocusable = this.getFirstFocusable();
      if (firstFocusable) {
        firstFocusable.focus();
      }
    });
  }

  private hide(): void {
    this.container.style.display = "none";

    document.removeEventListener("mousedown", this.boundHandleClickOutside);
    document.removeEventListener("keydown", this.boundHandleKeydown);
    this.editorView.dom.closest(".editor-container")?.removeEventListener(
      "scroll",
      this.boundHandleScroll,
      true
    );
    this.container.removeEventListener("keydown", this.handleTabNavigation);

    this.host = null;
    this.onHide();
  }

  private handleTabNavigation = (e: KeyboardEvent): void => {
    if (isImeKeyEvent(e)) return;
    handlePopupTabNavigation(e, this.container);
  };

  private handleClickOutside(e: MouseEvent): void {
    if (this.justOpened) return;
    const state = this.store.getState();
    if (!state.isOpen) return;
    if (!this.container.contains(e.target as Node)) {
      this.closePopup();
    }
  }

  private handleScroll(): void {
    if (this.store.getState().isOpen) {
      this.closePopup();
    }
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (isImeKeyEvent(e)) return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.closePopup();
      this.editorView.focus();
    }
  }

  protected closePopup(): void {
    const state = this.store.getState();
    if (typeof state.closePopup === "function") {
      state.closePopup();
    }
  }

  protected focusEditor(): void {
    this.editorView.focus();
  }

  protected updatePosition(anchorRect: AnchorRect): void {
    const dimensions = this.getPopupDimensions();
    const bounds = this.host === document.body
      ? getViewportBounds()
      : getBoundaryRects(this.editorView.dom, this.editorView.dom);

    const { top, left } = calculatePopupPosition({
      anchor: anchorRect,
      popup: { width: dimensions.width, height: dimensions.height },
      bounds,
      gap: dimensions.gap ?? 6,
      preferAbove: dimensions.preferAbove ?? true,
    });

    if (this.host !== document.body && this.host) {
      const hostPos = toHostCoordsForDom(this.host, { top, left });
      this.container.style.top = `${hostPos.top}px`;
      this.container.style.left = `${hostPos.left}px`;
    } else {
      this.container.style.top = `${top}px`;
      this.container.style.left = `${left}px`;
    }
  }

  protected isVisible(): boolean {
    return this.container.style.display !== "none";
  }

  protected buildIconButton(iconSvg: string, title: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "popup-icon-btn";
    btn.title = title;
    btn.innerHTML = iconSvg;
    btn.addEventListener("click", onClick);
    return btn;
  }

  destroy(): void {
    this.unsubscribe();
    document.removeEventListener("mousedown", this.boundHandleClickOutside);
    document.removeEventListener("keydown", this.boundHandleKeydown);
    this.editorView.dom.closest(".editor-container")?.removeEventListener(
      "scroll",
      this.boundHandleScroll,
      true
    );
    this.container.removeEventListener("keydown", this.handleTabNavigation);
    this.container.remove();
  }
}
