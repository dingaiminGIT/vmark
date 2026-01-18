/**
 * Inline Node Editing Plugin
 *
 * Adds `.editing` class to inline nodes (math, images, footnotes) when
 * the cursor is inside them. This provides visual feedback for nodes
 * that can't show a text cursor.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const EDITABLE_NODE_TYPES = ["math_inline", "image", "footnote_reference"];

const pluginKey = new PluginKey("inlineNodeEditing");

function computeDecorations(state: EditorState): DecorationSet {
  const { selection, doc } = state;
  const { from } = selection;
  const decorations: Decoration[] = [];

  // Find the node at cursor position
  const $pos = doc.resolve(from);

  // Check parent nodes for editable types
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth);
    if (EDITABLE_NODE_TYPES.includes(node.type.name)) {
      const start = $pos.before(depth);
      const end = $pos.after(depth);
      decorations.push(
        Decoration.node(start, end, { class: "editing" })
      );
      break;
    }
  }

  // Also check if cursor is directly before/after an inline node
  // This handles the case where cursor is at the edge of the node
  const nodeAfter = $pos.nodeAfter;
  if (nodeAfter && EDITABLE_NODE_TYPES.includes(nodeAfter.type.name)) {
    decorations.push(
      Decoration.node(from, from + nodeAfter.nodeSize, { class: "editing" })
    );
  }

  return DecorationSet.create(doc, decorations);
}

export const inlineNodeEditingExtension = Extension.create({
  name: "inlineNodeEditing",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        state: {
          init(_, state) {
            return computeDecorations(state);
          },
          apply(tr, oldDecorations, _oldState, newState) {
            if (tr.docChanged || tr.selectionSet) {
              return computeDecorations(newState);
            }
            return oldDecorations.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
