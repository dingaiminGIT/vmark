/**
 * Source Link Create Popup Plugin
 *
 * CodeMirror 6 plugin for creating links in Source mode.
 * Shows a popup with text + URL inputs when no clipboard URL available.
 */

import { ViewPlugin, type EditorView, type ViewUpdate } from "@codemirror/view";
import { SourceLinkCreatePopupView } from "./SourceLinkCreatePopupView";

/**
 * Create the Source link create popup plugin.
 */
export function createSourceLinkCreatePopupPlugin() {
  return ViewPlugin.fromClass(
    class SourceLinkCreatePopupPluginInstance {
      private popupView: SourceLinkCreatePopupView;

      constructor(view: EditorView) {
        this.popupView = new SourceLinkCreatePopupView(view);
      }

      update(_update: ViewUpdate) {
        // Popup responds to store changes, no update needed here
      }

      destroy() {
        this.popupView.destroy();
      }
    }
  );
}
