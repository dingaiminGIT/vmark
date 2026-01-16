import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { useWikiLinkPopupStore } from "@/stores/wikiLinkPopupStore";
import { WikiLinkPopupView } from "./WikiLinkPopupView";

const wikiLinkPopupPluginKey = new PluginKey("wikiLinkPopup");

const HOVER_DELAY = 300;

class WikiLinkPopupPluginView {
  private popupView: WikiLinkPopupView;
  private view: EditorView;
  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentLinkElement: HTMLElement | null = null;

  constructor(view: EditorView) {
    this.view = view;
    this.popupView = new WikiLinkPopupView(view);

    view.dom.addEventListener("mouseover", this.handleMouseOver);
    view.dom.addEventListener("mouseout", this.handleMouseOut);
  }

  private handleMouseOver = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const linkElement = target.closest("span.wiki-link") as HTMLElement | null;

    if (!linkElement) {
      this.clearHoverTimeout();
      return;
    }

    if (linkElement === this.currentLinkElement) return;

    this.clearHoverTimeout();
    this.currentLinkElement = linkElement;

    this.hoverTimeout = setTimeout(() => {
      this.showPopupForLink(linkElement);
    }, HOVER_DELAY);
  };

  private handleMouseOut = (event: MouseEvent) => {
    const relatedTarget = event.relatedTarget as HTMLElement | null;

    const popup = document.querySelector(".wiki-link-popup");
    if (popup && (popup.contains(relatedTarget) || popup === relatedTarget)) {
      return;
    }

    if (relatedTarget?.closest("span.wiki-link")) return;

    this.clearHoverTimeout();
    this.currentLinkElement = null;

    this.hoverTimeout = setTimeout(() => {
      const popupEl = document.querySelector(".wiki-link-popup");
      if (popupEl && !popupEl.matches(":hover")) {
        useWikiLinkPopupStore.getState().closePopup();
      }
    }, 100);
  };

  private showPopupForLink(linkElement: HTMLElement) {
    try {
      const pos = this.view.posAtDOM(linkElement, 0);
      const node = this.view.state.doc.nodeAt(pos);
      if (!node || node.type.name !== "wikiLink") return;

      const rect = linkElement.getBoundingClientRect();
      useWikiLinkPopupStore.getState().openPopup(
        {
          top: rect.top,
          left: rect.left,
          bottom: rect.bottom,
          right: rect.right,
        },
        String(node.attrs.value ?? ""),
        node.attrs.alias ? String(node.attrs.alias) : "",
        pos
      );
    } catch (error) {
      if (import.meta.env.DEV) {
        console.debug("[WikiLinkPopup] Failed to show popup:", error);
      }
    }
  }

  private clearHoverTimeout() {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }

  update() {
    // Popup updates via store subscription
  }

  destroy() {
    this.clearHoverTimeout();
    this.view.dom.removeEventListener("mouseover", this.handleMouseOver);
    this.view.dom.removeEventListener("mouseout", this.handleMouseOut);
    this.popupView.destroy();
  }
}

export const wikiLinkPopupExtension = Extension.create({
  name: "wikiLinkPopup",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: wikiLinkPopupPluginKey,
        view: (editorView) => new WikiLinkPopupPluginView(editorView),
      }),
    ];
  },
});
