import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { useHtmlBlockPopupStore } from "@/stores/htmlBlockPopupStore";
import { HtmlBlockPopupView } from "./HtmlBlockPopupView";

const htmlBlockPopupPluginKey = new PluginKey("htmlBlockPopup");

function findHtmlElement(target: HTMLElement): HTMLElement | null {
  return target.closest("[data-type=\"html\"], [data-type=\"html-block\"]");
}

function handleClick(view: EditorView, _pos: number, event: MouseEvent): boolean {
  const target = event.target as HTMLElement;
  const htmlElement = findHtmlElement(target);
  if (!htmlElement) return false;

  try {
    const nodePos = view.posAtDOM(htmlElement, 0);
    const node = view.state.doc.nodeAt(nodePos);
    if (!node || (node.type.name !== "html_inline" && node.type.name !== "html_block")) {
      return false;
    }

    const rect = htmlElement.getBoundingClientRect();
    useHtmlBlockPopupStore.getState().openPopup(
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
      console.debug("[HtmlPopup] Click handler error:", error);
    }
  }

  return false;
}

class HtmlBlockPopupPluginView {
  private popupView: HtmlBlockPopupView;

  constructor(view: EditorView) {
    this.popupView = new HtmlBlockPopupView(view);
  }

  update() {
    // Popup updates via store subscription
  }

  destroy() {
    this.popupView.destroy();
  }
}

export const htmlBlockPopupExtension = Extension.create({
  name: "htmlBlockPopup",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: htmlBlockPopupPluginKey,
        view: (editorView) => new HtmlBlockPopupPluginView(editorView),
        props: { handleClick },
      }),
    ];
  },
});
