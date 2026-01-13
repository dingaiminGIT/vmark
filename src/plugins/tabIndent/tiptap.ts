/**
 * Tab Indent Extension for Tiptap
 *
 * Fallback Tab handler that inserts spaces when Tab is not handled
 * by other extensions (slash menu, auto-pair jump, list indent, etc.).
 *
 * This prevents Tab from moving focus outside the editor.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { useSettingsStore } from "@/stores/settingsStore";

const tabIndentPluginKey = new PluginKey("tabIndent");

/**
 * Get the configured tab size (number of spaces).
 */
function getTabSize(): number {
  return useSettingsStore.getState().general.tabSize;
}

export const tabIndentExtension = Extension.create({
  name: "tabIndent",
  // Low priority - runs after all other Tab handlers
  priority: 50,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: tabIndentPluginKey,
        props: {
          handleDOMEvents: {
            keydown: (view, event) => {
              // Skip if not Tab or has modifiers (except Shift)
              if (event.key !== "Tab") return false;
              if (event.ctrlKey || event.altKey || event.metaKey) return false;

              // Skip IME composition
              if (event.isComposing || event.keyCode === 229) return false;

              const { state, dispatch } = view;
              const { selection } = state;

              // Handle Shift+Tab: outdent (remove up to tabSize spaces before cursor)
              if (event.shiftKey) {
                event.preventDefault();
                const { from } = selection;
                const $from = state.doc.resolve(from);
                const lineStart = $from.start();
                const textBefore = state.doc.textBetween(lineStart, from, "\n");

                // Count leading spaces
                const leadingSpaces = textBefore.match(/^[ ]*/)?.[0].length ?? 0;
                if (leadingSpaces === 0) return true;

                // Remove up to tabSize spaces
                const spacesToRemove = Math.min(leadingSpaces, getTabSize());
                const tr = state.tr.delete(lineStart, lineStart + spacesToRemove);
                dispatch(tr);
                return true;
              }

              // Handle Tab: insert spaces
              event.preventDefault();
              const spaces = " ".repeat(getTabSize());

              // If there's a selection, replace it with spaces
              if (!selection.empty) {
                const tr = state.tr.replaceSelectionWith(
                  state.schema.text(spaces),
                  true
                );
                dispatch(tr);
                return true;
              }

              // Insert spaces at cursor
              const tr = state.tr.insertText(spaces);
              dispatch(tr);
              return true;
            },
          },
        },
      }),
    ];
  },
});
