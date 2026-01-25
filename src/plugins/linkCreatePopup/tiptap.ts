/**
 * Link Create Popup Tiptap Extension
 *
 * Registers the link create popup view with the editor.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { LinkCreatePopupView } from "./LinkCreatePopupView";

const linkCreatePopupPluginKey = new PluginKey("linkCreatePopup");

export const linkCreatePopupExtension = Extension.create({
  name: "linkCreatePopup",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: linkCreatePopupPluginKey,
        view: (view) => {
          const popupView = new LinkCreatePopupView(view);
          return {
            destroy: () => popupView.destroy(),
          };
        },
      }),
    ];
  },
});
