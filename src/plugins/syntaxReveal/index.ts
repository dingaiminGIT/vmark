/**
 * Syntax Reveal Plugin
 *
 * Shows markdown syntax markers when cursor is inside formatted content.
 * Uses ProseMirror decorations to display syntax without modifying document.
 *
 * Supports:
 * - Marks: bold (**), italic (*), code (`), strikethrough (~~), link ([])
 * - Nodes: headings (#), code blocks (```), blockquotes (>), lists (-, 1.)
 */

import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { addMarkSyntaxDecorations } from "./marks";
import { addNodeSyntaxDecorations } from "./nodes";

// Plugin key for external access
export const syntaxRevealPluginKey = new PluginKey("syntaxReveal");

/**
 * Create the syntax reveal plugin
 */
export const syntaxRevealPlugin = $prose(() => {
  return new Plugin({
    key: syntaxRevealPluginKey,

    props: {
      decorations(state) {
        const { selection } = state;
        const { $from, empty } = selection;

        // Only show syntax for cursor (not selection)
        if (!empty) {
          return DecorationSet.empty;
        }

        const decorations: Decoration[] = [];
        const pos = $from.pos;

        // Add mark-based syntax decorations (bold, italic, etc.)
        addMarkSyntaxDecorations(decorations, pos, $from);

        // Add node-based syntax decorations (headings, lists, etc.)
        addNodeSyntaxDecorations(decorations, $from);

        if (decorations.length === 0) {
          return DecorationSet.empty;
        }

        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
});

export default syntaxRevealPlugin;
