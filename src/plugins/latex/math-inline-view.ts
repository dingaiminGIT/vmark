/**
 * Math Inline NodeView and Plugin
 *
 * -style cursor-aware rendering:
 * - Shows rendered KaTeX when cursor is outside
 * - Shows raw LaTeX text when cursor is inside (editable)
 *
 * Uses a combination of:
 * - NodeView for custom DOM structure (preview + editable content)
 * - Plugin with decorations to add 'editing' class based on cursor position
 */

import { $view, $prose } from "@milkdown/kit/utils";
import type { EditorView, NodeView } from "@milkdown/kit/prose/view";
import type { Node } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import katex from "katex";
import { mathInlineSchema } from "./inline-latex";
import { mathInlineId } from "./inline-latex";

/**
 * NodeView for inline math with dual-mode rendering.
 * The actual toggling is done via CSS class added by the companion plugin.
 */
class MathInlineNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;

  private preview: HTMLElement;
  private view: EditorView;
  private getPos: () => number | undefined;

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.view = view;
    this.getPos = getPos;

    // Create container span
    this.dom = document.createElement("span");
    this.dom.className = "math-inline";
    this.dom.dataset.type = "math_inline";

    // Create preview element for KaTeX rendering
    this.preview = document.createElement("span");
    this.preview.className = "math-inline-preview";
    this.preview.addEventListener("click", this.handlePreviewClick);
    this.dom.appendChild(this.preview);

    // contentDOM is where ProseMirror manages text content
    this.contentDOM = document.createElement("span");
    this.contentDOM.className = "math-inline-content";
    this.dom.appendChild(this.contentDOM);

    // Initial render
    this.renderPreview(node.textContent || "");
  }

  /**
   * Handle click on preview to place cursor inside the math node
   */
  private handlePreviewClick = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    const pos = this.getPos();
    if (pos === undefined) return;

    // Place cursor at start of math node content (pos + 1 to enter the node)
    const { tr } = this.view.state;
    const resolvedPos = tr.doc.resolve(pos + 1);
    this.view.dispatch(tr.setSelection(TextSelection.near(resolvedPos)));
    this.view.focus();
  };

  private renderPreview(content: string): void {
    const trimmed = content.trim();

    if (!trimmed) {
      this.preview.innerHTML = '<span class="math-inline-placeholder">$</span>';
      return;
    }

    try {
      katex.render(trimmed, this.preview, {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      this.preview.textContent = trimmed;
      this.preview.classList.add("math-error");
    }
  }

  update(node: Node): boolean {
    if (node.type.name !== mathInlineId) {
      return false;
    }

    // Update preview with new content
    this.renderPreview(node.textContent || "");
    return true;
  }

  destroy(): void {
    this.preview.removeEventListener("click", this.handlePreviewClick);
  }
}

/**
 * Milkdown plugin for inline math view.
 */
export const mathInlineView = $view(mathInlineSchema.node, () => {
  return (node, view, getPos) => new MathInlineNodeView(node, view, getPos);
});

/**
 * Plugin key for math inline cursor tracking
 */
export const mathInlineCursorKey = new PluginKey("mathInlineCursor");

/**
 * Plugin that adds 'editing' class to math_inline nodes when cursor is inside.
 * This triggers CSS to show raw content instead of preview.
 */
export const mathInlineCursorPlugin = $prose(() => {
  return new Plugin({
    key: mathInlineCursorKey,

    props: {
      decorations(state) {
        const { selection, doc } = state;
        const { from, to } = selection;

        const decorations: Decoration[] = [];

        // Find math_inline nodes that contain the cursor
        doc.descendants((node, pos) => {
          if (node.type.name !== mathInlineId) {
            return true; // Continue traversing
          }

          const nodeStart = pos;
          const nodeEnd = pos + node.nodeSize;

          // Check if cursor is inside this node
          // from >= nodeStart means cursor is at or after node start
          // to <= nodeEnd means cursor is at or before node end
          const cursorInside = from >= nodeStart && to <= nodeEnd;
          if (cursorInside) {
            // Add decoration to mark this node as being edited
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: "editing",
              })
            );
          }

          return false; // Don't descend into math_inline
        });

        return DecorationSet.create(doc, decorations);
      },
    },
  });
});
