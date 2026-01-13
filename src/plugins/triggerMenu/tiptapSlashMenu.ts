import "./trigger-menu.css";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { SlashMenuView } from "./tiptapSlashMenuView";

const slashMenuPluginKey = new PluginKey("slashMenuTiptap");

export const slashMenuExtension = Extension.create({
  name: "slashMenu",
  // High priority to handle Enter before other keymaps
  priority: 1100,
  addProseMirrorPlugins() {
    let menuView: SlashMenuView | null = null;

    return [
      new Plugin({
        key: slashMenuPluginKey,
        view: (_view) => {
          menuView = new SlashMenuView(this.editor);
          return {
            update: (nextView) => menuView?.update(nextView),
            destroy: () => menuView?.destroy(),
          };
        },
        props: {
          // Use handleDOMEvents.keydown instead of handleKeyDown
          // to intercept keys before Tiptap's keyboard shortcuts system
          handleDOMEvents: {
            keydown: (_view, event) => menuView?.onKeyDown(event) ?? false,
          },
        },
      }),
    ];
  },
});
