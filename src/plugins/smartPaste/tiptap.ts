import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

const smartPastePluginKey = new PluginKey("smartPaste");

function isValidUrl(str: string): boolean {
  return /^https?:\/\//i.test(str.trim());
}

/**
 * Check if selection is inside a code block or has inline code mark.
 * Smart paste should be disabled in code contexts.
 */
function isSelectionInCode(state: EditorState): boolean {
  const { selection, schema } = state;
  const codeBlock = schema.nodes.codeBlock;
  const codeMark = schema.marks.code;

  // Check if inside code block
  if (codeBlock) {
    for (let depth = selection.$from.depth; depth > 0; depth--) {
      if (selection.$from.node(depth).type === codeBlock) return true;
    }
  }

  // Check if has inline code mark
  if (codeMark) {
    const fromMarks = selection.$from.marks();
    if (codeMark.isInSet(fromMarks)) return true;
  }

  return false;
}

function handlePaste(view: EditorView, event: ClipboardEvent): boolean {
  const { from, to, empty } = view.state.selection;

  if (empty) return false;

  // Don't apply link in code contexts
  if (isSelectionInCode(view.state)) return false;

  const url = event.clipboardData?.getData("text/plain")?.trim();
  if (!url || !isValidUrl(url)) return false;

  const linkMark = view.state.schema.marks.link;
  if (!linkMark) return false;
  if (view.state.doc.rangeHasMark(from, to, linkMark)) return false;

  event.preventDefault();
  const tr = view.state.tr.addMark(from, to, linkMark.create({ href: url }));
  view.dispatch(tr);
  return true;
}

export const smartPasteExtension = Extension.create({
  name: "smartPaste",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: smartPastePluginKey,
        props: {
          handlePaste,
        },
      }),
    ];
  },
});

