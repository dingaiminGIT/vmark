/**
 * Floating Math Preview for WYSIWYG Mode
 *
 * Shows a floating preview when editing a latex/math code block.
 * Only shows when block is in editing mode (via blockMathEditingStore).
 * Handles both "latex" (from code fences) and "$$math$$" (from $$ syntax).
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { getMathPreviewView } from "@/plugins/mathPreview/MathPreviewView";
import { useBlockMathEditingStore } from "@/stores/blockMathEditingStore";

const floatingMathPreviewKey = new PluginKey("floatingMathPreview");

/** Check if language is a latex/math language */
function isLatexLanguage(lang: string): boolean {
  return lang === "latex" || lang === "$$math$$";
}

export const floatingMathPreviewExtension = Extension.create({
  name: "floatingMathPreview",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: floatingMathPreviewKey,
        view(editorView) {
          let currentCodeBlockPos: number | null = null;
          let updateScheduled = false;

          const scheduleUpdate = () => {
            if (updateScheduled) return;
            updateScheduled = true;
            requestAnimationFrame(() => {
              updateScheduled = false;
              checkMathAtCursor();
            });
          };

          const checkMathAtCursor = () => {
            const { editingPos } = useBlockMathEditingStore.getState();

            // Only show preview when in editing mode
            if (editingPos === null) {
              hidePreview();
              return;
            }

            const { state } = editorView;
            const node = state.doc.nodeAt(editingPos);

            if (!node || (node.type.name !== "codeBlock" && node.type.name !== "code_block")) {
              hidePreview();
              return;
            }

            const language = (node.attrs.language ?? "").toLowerCase();

            // Only show floating preview for latex (mermaid is async and complex)
            if (!isLatexLanguage(language)) {
              hidePreview();
              return;
            }

            currentCodeBlockPos = editingPos;
            const nodeEnd = editingPos + node.nodeSize;
            showPreview(node.textContent, editingPos, nodeEnd);
          };

          const showPreview = (content: string, from: number, to: number) => {
            const preview = getMathPreviewView();

            // Get coordinates for the code block
            try {
              const fromCoords = editorView.coordsAtPos(from);
              const toCoords = editorView.coordsAtPos(to);

              // Use editor bounds for horizontal centering
              const editorRect = editorView.dom.getBoundingClientRect();
              const anchorRect = {
                top: fromCoords.top,
                left: editorRect.left,
                bottom: toCoords.bottom,
                right: editorRect.right,
              };

              if (preview.isVisible()) {
                preview.updateContent(content);
                preview.updatePosition(anchorRect);
              } else {
                preview.show(content, anchorRect, editorView.dom);
              }
            } catch {
              // Position calculation failed
              hidePreview();
            }
          };

          const hidePreview = () => {
            if (currentCodeBlockPos !== null) {
              currentCodeBlockPos = null;
              getMathPreviewView().hide();
            }
          };

          // Initial check
          scheduleUpdate();

          return {
            update(view, prevState) {
              if (view.state.selection !== prevState.selection || view.state.doc !== prevState.doc) {
                scheduleUpdate();
              }
            },
            destroy() {
              hidePreview();
            },
          };
        },
      }),
    ];
  },
});
