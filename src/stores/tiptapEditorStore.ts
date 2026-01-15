import { create } from "zustand";
import type { Editor as TiptapEditor } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";
import type { CursorContext } from "@/plugins/toolbarContext/types";

interface TiptapEditorState {
  editor: TiptapEditor | null;
  editorView: EditorView | null;
  context: CursorContext | null;
}

interface TiptapEditorActions {
  setEditor: (editor: TiptapEditor | null) => void;
  setContext: (context: CursorContext, view: EditorView) => void;
  clear: () => void;
}

const initialState: TiptapEditorState = {
  editor: null,
  editorView: null,
  context: null,
};

export const useTiptapEditorStore = create<TiptapEditorState & TiptapEditorActions>((set) => ({
  ...initialState,

  setEditor: (editor) => {
    set({ editor, editorView: editor ? editor.view : null });
  },

  setContext: (context, view) => {
    set({ context, editorView: view });
  },

  clear: () => set(initialState),
}));
