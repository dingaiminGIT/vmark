import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open, message } from "@tauri-apps/plugin-dialog";
import { editorViewCtx } from "@milkdown/kit/core";
import type { Editor } from "@milkdown/kit/core";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node, Mark } from "@milkdown/kit/prose/model";
import { useDocumentStore } from "@/stores/documentStore";
import { copyImageToAssets, insertImageNode } from "@/utils/imageUtils";
import { isWindowFocused, getWindowLabel } from "@/utils/windowFocus";
import { findMarkRange } from "@/plugins/syntaxReveal/marks";

// Re-entry guard for image insertion (prevents duplicate dialogs)
const isInsertingImageRef = { current: false };

type GetEditor = () => Editor | undefined;

/**
 * Toggle a mark on the current selection or at cursor position.
 * Replicates the expandedToggleMark behavior from editorPlugins.ts
 */
function toggleMark(view: EditorView, markTypeName: string): boolean {
  const { state, dispatch } = view;
  const markType = state.schema.marks[markTypeName];

  // Debug: log available marks
  console.log("[toggleMark] Requested:", markTypeName);
  console.log("[toggleMark] Available marks:", Object.keys(state.schema.marks));

  if (!markType) {
    console.error("[toggleMark] Mark type not found:", markTypeName);
    return false;
  }

  const { from, to, empty } = state.selection;
  const $from = state.selection.$from;

  if (!empty) {
    // Has selection - standard toggle
    if (state.doc.rangeHasMark(from, to, markType)) {
      dispatch(state.tr.removeMark(from, to, markType));
    } else {
      dispatch(state.tr.addMark(from, to, markType.create()));
    }
    return true;
  }

  // Empty selection - find mark range at cursor
  const markRange = findMarkRange(
    from,
    markType.create(),
    $from.start(),
    $from.parent
  );

  if (markRange) {
    // Cursor inside mark - remove from entire range
    dispatch(state.tr.removeMark(markRange.from, markRange.to, markType));
    return true;
  } else {
    // Toggle stored mark
    const storedMarks = state.storedMarks || $from.marks();
    if (markType.isInSet(storedMarks)) {
      dispatch(state.tr.removeStoredMark(markType));
    } else {
      dispatch(state.tr.addStoredMark(markType.create()));
    }
    return true;
  }
}

export function useFormatCommands(getEditor: GetEditor) {
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    let cancelled = false;

    const setupListeners = async () => {
      // Clean up any existing listeners first
      unlistenRefs.current.forEach((fn) => fn());
      unlistenRefs.current = [];

      if (cancelled) return;

      // Insert Image - copies to assets folder
      const unlistenImage = await listen("menu:image", async () => {
        if (!(await isWindowFocused())) return;
        if (isInsertingImageRef.current) return;
        isInsertingImageRef.current = true;

        try {
          const sourcePath = await open({
            filters: [
              {
                name: "Images",
                extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"],
              },
            ],
          });

          if (!sourcePath) return;

          const windowLabel = getWindowLabel();
          const doc = useDocumentStore.getState().getDocument(windowLabel);
          const filePath = doc?.filePath;
          const editor = getEditor();
          if (!editor) return;

          if (!filePath) {
            // Document unsaved - show warning
            await message(
              "Please save the document first to copy images to assets folder.",
              { title: "Unsaved Document", kind: "warning" }
            );
            return;
          }

          // Copy to assets folder and get relative path (portable)
          const relativePath = await copyImageToAssets(sourcePath as string, filePath);

          // Insert with relative path - imageViewPlugin will resolve for rendering
          editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            insertImageNode(view, relativePath);
          });
        } catch (error) {
          console.error("Failed to insert image:", error);
          await message("Failed to insert image.", { kind: "error" });
        } finally {
          isInsertingImageRef.current = false;
        }
      });
      if (cancelled) { unlistenImage(); return; }
      unlistenRefs.current.push(unlistenImage);

      // Clear Format
      const unlistenClearFormat = await listen("menu:clear-format", async () => {
        if (!(await isWindowFocused())) return;
        const editor = getEditor();
        if (editor) {
          editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            if (!view) return;
            const { state, dispatch } = view;
            const { from, to } = state.selection;
            if (from === to) return;

            let tr = state.tr;
            state.doc.nodesBetween(from, to, (node: Node, pos: number) => {
              if (node.isText && node.marks.length > 0) {
                node.marks.forEach((mark: Mark) => {
                  tr = tr.removeMark(
                    Math.max(from, pos),
                    Math.min(to, pos + node.nodeSize),
                    mark.type
                  );
                });
              }
            });

            if (tr.docChanged) {
              dispatch(tr);
            }
          });
        }
      });
      if (cancelled) { unlistenClearFormat(); return; }
      unlistenRefs.current.push(unlistenClearFormat);

      // Helper to create mark toggle listener
      const createMarkListener = async (eventName: string, markType: string) => {
        const unlisten = await listen(eventName, async () => {
          console.log(`[useFormatCommands] Received event: ${eventName}`);
          if (!(await isWindowFocused())) {
            console.log(`[useFormatCommands] Window not focused, ignoring`);
            return;
          }
          const editor = getEditor();
          if (editor) {
            editor.action((ctx) => {
              const view = ctx.get(editorViewCtx);
              if (view) {
                toggleMark(view, markType);
              } else {
                console.error(`[useFormatCommands] No editor view for ${eventName}`);
              }
            });
          } else {
            console.error(`[useFormatCommands] No editor for ${eventName}`);
          }
        });
        if (cancelled) { unlisten(); return null; }
        return unlisten;
      };

      // Bold
      const unlistenBold = await createMarkListener("menu:bold", "strong");
      if (unlistenBold) unlistenRefs.current.push(unlistenBold);
      if (cancelled) return;

      // Italic
      const unlistenItalic = await createMarkListener("menu:italic", "emphasis");
      if (unlistenItalic) unlistenRefs.current.push(unlistenItalic);
      if (cancelled) return;

      // Strikethrough (Milkdown uses "strike_through" with underscore)
      const unlistenStrikethrough = await createMarkListener("menu:strikethrough", "strike_through");
      if (unlistenStrikethrough) unlistenRefs.current.push(unlistenStrikethrough);
      if (cancelled) return;

      // Inline Code
      const unlistenCode = await createMarkListener("menu:code", "inlineCode");
      if (unlistenCode) unlistenRefs.current.push(unlistenCode);
      if (cancelled) return;

      // Link
      const unlistenLink = await createMarkListener("menu:link", "link");
      if (unlistenLink) unlistenRefs.current.push(unlistenLink);
      if (cancelled) return;
    };

    setupListeners();

    return () => {
      cancelled = true;
      const fns = unlistenRefs.current;
      unlistenRefs.current = [];
      fns.forEach((fn) => fn());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
