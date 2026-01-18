/**
 * Image Paste Toast View
 *
 * DOM management for the image paste confirmation toast.
 * Shows when pasting text that looks like an image URL/path,
 * allowing user to choose between inserting as image or text.
 */

import { useImagePasteToastStore } from "@/stores/imagePasteToastStore";
import {
  calculatePopupPosition,
  getViewportBounds,
  type AnchorRect,
} from "@/utils/popupPosition";
import { isImeKeyEvent } from "@/utils/imeGuard";

const AUTO_DISMISS_MS = 5000;

// SVG Icons
const icons = {
  image: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
};

/**
 * Image paste toast view - manages the floating toast UI.
 */
export class ImagePasteToastView {
  private container: HTMLElement;
  private unsubscribe: () => void;
  private autoDismissTimer: number | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    // Build DOM structure
    this.container = this.buildContainer();

    // Append to document body
    document.body.appendChild(this.container);

    // Subscribe to store changes
    this.unsubscribe = useImagePasteToastStore.subscribe((state) => {
      if (state.isOpen && state.anchorRect) {
        this.show(state.imagePath, state.imageType, state.anchorRect);
      } else {
        this.hide();
      }
    });

    // Handle click outside
    document.addEventListener("mousedown", this.handleClickOutside);
  }

  private buildContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = "image-paste-toast";
    container.style.display = "none";

    // Icon
    const iconEl = document.createElement("span");
    iconEl.className = "image-paste-toast-icon";
    iconEl.innerHTML = icons.image;

    // Message
    const messageEl = document.createElement("span");
    messageEl.className = "image-paste-toast-message";
    messageEl.textContent = "Image detected";

    // Buttons container
    const buttonsEl = document.createElement("div");
    buttonsEl.className = "image-paste-toast-buttons";

    // Insert button (primary)
    const insertBtn = document.createElement("button");
    insertBtn.type = "button";
    insertBtn.className = "image-paste-toast-btn image-paste-toast-btn-primary";
    insertBtn.textContent = "Insert Image";
    insertBtn.addEventListener("click", this.handleInsert);

    // Dismiss button
    const dismissBtn = document.createElement("button");
    dismissBtn.type = "button";
    dismissBtn.className = "image-paste-toast-btn";
    dismissBtn.textContent = "Paste as Text";
    dismissBtn.addEventListener("click", this.handleDismiss);

    buttonsEl.appendChild(insertBtn);
    buttonsEl.appendChild(dismissBtn);

    container.appendChild(iconEl);
    container.appendChild(messageEl);
    container.appendChild(buttonsEl);

    return container;
  }

  private show(_imagePath: string, imageType: "url" | "localPath", anchorRect: AnchorRect) {
    // Update message based on type (imagePath reserved for future tooltip use)
    const messageEl = this.container.querySelector(".image-paste-toast-message");
    if (messageEl) {
      messageEl.textContent = imageType === "url" ? "Image URL detected" : "Image path detected";
    }

    this.container.style.display = "flex";
    this.container.style.position = "fixed";

    // Calculate position
    const bounds = getViewportBounds();
    const { top, left } = calculatePopupPosition({
      anchor: anchorRect,
      popup: { width: 280, height: 40 },
      bounds,
      gap: 8,
      preferAbove: true,
    });

    this.container.style.top = `${top}px`;
    this.container.style.left = `${left}px`;

    // Set up keyboard handling
    this.setupKeyboardHandler();

    // Start auto-dismiss timer
    this.startAutoDismissTimer();

    // Focus the insert button
    requestAnimationFrame(() => {
      const insertBtn = this.container.querySelector(".image-paste-toast-btn-primary") as HTMLButtonElement;
      if (insertBtn) {
        insertBtn.focus();
      }
    });
  }

  private hide() {
    this.container.style.display = "none";
    this.clearAutoDismissTimer();
    this.removeKeyboardHandler();
  }

  private setupKeyboardHandler() {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (isImeKeyEvent(e)) return;

      const { isOpen } = useImagePasteToastStore.getState();
      if (!isOpen) return;

      if (e.key === "Enter") {
        e.preventDefault();
        this.handleInsert();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.handleDismiss();
      } else if (e.key === "Tab") {
        // Trap focus within toast
        e.preventDefault();
        const buttons = this.container.querySelectorAll<HTMLButtonElement>(".image-paste-toast-btn");
        const activeEl = document.activeElement as HTMLElement;
        const currentIndex = Array.from(buttons).indexOf(activeEl as HTMLButtonElement);
        const nextIndex = e.shiftKey
          ? (currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1)
          : (currentIndex >= buttons.length - 1 ? 0 : currentIndex + 1);
        buttons[nextIndex].focus();
      }
    };

    document.addEventListener("keydown", this.keydownHandler);
  }

  private removeKeyboardHandler() {
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
  }

  private startAutoDismissTimer() {
    this.clearAutoDismissTimer();
    this.autoDismissTimer = window.setTimeout(() => {
      // Auto-dismiss = paste as text (the safe default)
      this.handleDismiss();
    }, AUTO_DISMISS_MS);
  }

  private clearAutoDismissTimer() {
    if (this.autoDismissTimer !== null) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
  }

  private handleInsert = () => {
    useImagePasteToastStore.getState().confirm();
  };

  private handleDismiss = () => {
    useImagePasteToastStore.getState().dismiss();
  };

  private handleClickOutside = (e: MouseEvent) => {
    const { isOpen } = useImagePasteToastStore.getState();
    if (!isOpen) return;

    const target = e.target as Node;
    if (!this.container.contains(target)) {
      // Click outside = dismiss (paste as text)
      this.handleDismiss();
    }
  };

  destroy() {
    this.unsubscribe();
    this.clearAutoDismissTimer();
    this.removeKeyboardHandler();
    document.removeEventListener("mousedown", this.handleClickOutside);
    this.container.remove();
  }
}

// Singleton instance
let instance: ImagePasteToastView | null = null;

/**
 * Initialize the image paste toast view (call once at app startup).
 */
export function initImagePasteToast(): void {
  if (!instance) {
    instance = new ImagePasteToastView();
  }
}

/**
 * Destroy the image paste toast view.
 */
export function destroyImagePasteToast(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
