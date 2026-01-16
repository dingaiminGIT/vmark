import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { useWikiEmbedPopupStore } from "@/stores/wikiEmbedPopupStore";
import { WikiEmbedPopupView } from "./WikiEmbedPopupView";

const wikiEmbedPopupPluginKey = new PluginKey("wikiEmbedPopup");

function handleClick(view: EditorView, _pos: number, event: MouseEvent): boolean {
  const target = event.target as HTMLElement;
  const embedElement = target.closest("span.wiki-embed") as HTMLElement | null;
  if (!embedElement) return false;

  try {
    const nodePos = view.posAtDOM(embedElement, 0);
    const node = view.state.doc.nodeAt(nodePos);
    if (!node || node.type.name !== "wikiEmbed") return false;

    const rect = embedElement.getBoundingClientRect();
    useWikiEmbedPopupStore.getState().openPopup(
      {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
      },
      String(node.attrs.value ?? ""),
      nodePos
    );
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug("[WikiEmbedPopup] Click handler error:", error);
    }
  }

  return false;
}

class WikiEmbedPopupPluginView {
  private popupView: WikiEmbedPopupView;

  constructor(view: EditorView) {
    this.popupView = new WikiEmbedPopupView(view);
  }

  update() {
    // Popup updates via store subscription
  }

  destroy() {
    this.popupView.destroy();
  }
}

export const wikiEmbedPopupExtension = Extension.create({
  name: "wikiEmbedPopup",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: wikiEmbedPopupPluginKey,
        view: (editorView) => new WikiEmbedPopupPluginView(editorView),
        props: { handleClick },
      }),
    ];
  },
});
