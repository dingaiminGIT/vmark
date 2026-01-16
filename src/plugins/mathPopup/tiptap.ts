import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { MathPopupView } from "./MathPopupView";

const mathPopupPluginKey = new PluginKey("mathPopup");

class MathPopupPluginView {
  private popupView: MathPopupView;

  constructor(view: EditorView) {
    this.popupView = new MathPopupView(view);
  }

  update() {
    // No-op: popup updates via store subscription
  }

  destroy() {
    this.popupView.destroy();
  }
}

export const mathPopupExtension = Extension.create({
  name: "mathPopup",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: mathPopupPluginKey,
        view: (editorView) => new MathPopupPluginView(editorView),
      }),
    ];
  },
});
