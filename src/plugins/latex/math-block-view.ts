/**
 * Math Block NodeView
 *
 * -style click-to-edit behavior:
 * - Shows rendered KaTeX by default
 * - Click to reveal textarea editor
 * - Blur to save and show rendered output
 */

import { $view } from "@milkdown/kit/utils";
import type { EditorView, NodeView } from "@milkdown/kit/prose/view";
import type { Node } from "@milkdown/kit/prose/model";
import { Selection } from "@milkdown/kit/prose/state";
import katex from "katex";
import { mathBlockSchema } from "./math-block-schema";

/**
 * NodeView for math block with click-to-edit.
 */
class MathBlockNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement | undefined = undefined;

  private preview: HTMLElement;
  private editor: HTMLTextAreaElement;
  private isEditing = false;
  private view: EditorView;
  private getPos: () => number | undefined;
  private currentContent: string;

  constructor(node: Node, view: EditorView, getPos: () => number | undefined) {
    this.view = view;
    this.getPos = getPos;
    this.currentContent = node.textContent || "";

    // Create container
    this.dom = document.createElement("div");
    this.dom.className = "math-block";
    this.dom.dataset.type = "math_block";

    // Create preview element
    this.preview = document.createElement("div");
    this.preview.className = "math-block-preview";
    this.preview.addEventListener("click", this.handlePreviewClick);
    this.dom.appendChild(this.preview);

    // Create editor textarea
    this.editor = document.createElement("textarea");
    this.editor.className = "math-block-editor";
    this.editor.placeholder = "Enter LaTeX math...";
    this.editor.addEventListener("blur", this.handleBlur);
    this.editor.addEventListener("keydown", this.handleKeyDown);
    this.editor.addEventListener("input", this.handleInput);
    this.dom.appendChild(this.editor);

    // Initial render
    this.renderPreview();
  }

  private renderPreview(): void {
    const content = this.currentContent.trim();

    if (!content) {
      this.preview.innerHTML = '<span class="math-block-placeholder">Click to add math equation...</span>';
      return;
    }

    try {
      katex.render(content, this.preview, {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      this.preview.innerHTML = `<pre class="math-error">${this.escapeHtml(content)}</pre>`;
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  private handlePreviewClick = (): void => {
    this.showEditor();
  };

  private handleBlur = (): void => {
    this.commitAndClose();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      this.commitAndClose();
      return;
    }
    // Allow Tab to insert tab character
    if (e.key === "Tab") {
      e.preventDefault();
      const start = this.editor.selectionStart;
      const end = this.editor.selectionEnd;
      this.editor.value = this.editor.value.substring(0, start) + "  " + this.editor.value.substring(end);
      this.editor.selectionStart = this.editor.selectionEnd = start + 2;
      return;
    }
    // Arrow navigation out of math block
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const cursorPos = this.editor.selectionStart;
      const content = this.editor.value;
      const lines = content.split("\n");

      // Find which line the cursor is on
      let charCount = 0;
      let currentLine = 0;
      for (let i = 0; i < lines.length; i++) {
        if (charCount + lines[i].length >= cursorPos) {
          currentLine = i;
          break;
        }
        charCount += lines[i].length + 1; // +1 for newline
      }

      // ArrowUp on first line or ArrowDown on last line exits the block
      if ((e.key === "ArrowUp" && currentLine === 0) || (e.key === "ArrowDown" && currentLine === lines.length - 1)) {
        e.preventDefault();
        this.commitAndClose();
        // Move cursor to appropriate position after the block
        const pos = this.getPos();
        if (pos !== undefined) {
          const { state } = this.view;
          const node = state.doc.nodeAt(pos);
          if (node) {
            const targetPos = e.key === "ArrowUp" ? pos : pos + node.nodeSize;
            const tr = state.tr.setSelection(
              Selection.near(state.doc.resolve(targetPos), e.key === "ArrowUp" ? -1 : 1)
            );
            this.view.dispatch(tr);
          }
        }
      }
    }
  };

  private handleInput = (): void => {
    // Auto-resize textarea
    this.editor.style.height = "auto";
    this.editor.style.height = this.editor.scrollHeight + "px";
  };

  private showEditor(): void {
    if (this.isEditing) return;
    this.isEditing = true;
    this.dom.classList.add("editing");
    this.editor.value = this.currentContent;
    this.editor.style.height = "auto";
    this.editor.style.height = Math.max(60, this.editor.scrollHeight) + "px";
    this.editor.focus();
    this.editor.select();
  }

  private commitAndClose(): void {
    if (!this.isEditing) return;
    this.isEditing = false;
    this.dom.classList.remove("editing");

    const newContent = this.editor.value;
    if (newContent !== this.currentContent) {
      this.currentContent = newContent;
      this.updateNode(newContent);
    }
    this.renderPreview();

    // Return focus to editor
    this.view.focus();
  }

  private updateNode(content: string): void {
    const pos = this.getPos();
    if (pos === undefined) return;

    const { state } = this.view;
    const node = state.doc.nodeAt(pos);
    if (!node) return;

    // Create transaction to replace node content
    const tr = state.tr;
    const start = pos + 1; // Inside the node
    const end = pos + node.nodeSize - 1;

    if (content) {
      tr.replaceWith(start, end, state.schema.text(content));
    } else {
      tr.delete(start, end);
    }

    this.view.dispatch(tr);
  }

  update(node: Node): boolean {
    if (node.type.name !== "math_block") {
      return false;
    }

    // Only update if not editing and content changed externally
    if (!this.isEditing) {
      const newContent = node.textContent || "";
      if (newContent !== this.currentContent) {
        this.currentContent = newContent;
        this.renderPreview();
      }
    }

    return true;
  }

  selectNode(): void {
    this.dom.classList.add("ProseMirror-selectednode");
    // Auto-enter edit mode when selected via keyboard navigation
    // Use setTimeout to avoid interfering with ProseMirror's selection handling
    setTimeout(() => {
      if (this.dom.classList.contains("ProseMirror-selectednode") && !this.isEditing) {
        this.showEditor();
      }
    }, 0);
  }

  deselectNode(): void {
    this.dom.classList.remove("ProseMirror-selectednode");
  }

  stopEvent(event: Event): boolean {
    // Let the editor handle all events when editing
    if (this.isEditing) {
      return true;
    }
    // Stop click events on preview
    if (event.type === "mousedown" || event.type === "click") {
      return true;
    }
    return false;
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy(): void {
    this.preview.removeEventListener("click", this.handlePreviewClick);
    this.editor.removeEventListener("blur", this.handleBlur);
    this.editor.removeEventListener("keydown", this.handleKeyDown);
    this.editor.removeEventListener("input", this.handleInput);
  }
}

/**
 * Milkdown plugin for math block view.
 */
export const mathBlockView = $view(mathBlockSchema.node, () => {
  return (node, view, getPos) => new MathBlockNodeView(node, view, getPos);
});
