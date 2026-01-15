import type { Editor as TiptapEditor } from "@tiptap/core";
import type { EditorView as TiptapEditorView } from "@tiptap/pm/view";
import type { EditorView as CodeMirrorView } from "@codemirror/view";
import type { CursorContext as WysiwygCursorContext } from "@/plugins/toolbarContext/types";
import type { CursorContext as SourceCursorContext } from "@/types/cursorContext";

export type ToolbarSurface = "wysiwyg" | "source";

export interface WysiwygToolbarContext {
  surface: "wysiwyg";
  view: TiptapEditorView | null;
  editor: TiptapEditor | null;
  context: WysiwygCursorContext | null;
}

export interface SourceToolbarContext {
  surface: "source";
  view: CodeMirrorView | null;
  context: SourceCursorContext | null;
}

export type ToolbarContext = WysiwygToolbarContext | SourceToolbarContext;
