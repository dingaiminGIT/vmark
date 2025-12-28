import { create } from "zustand";

// Cursor position info for syncing between editors
export interface CursorInfo {
  contentLineIndex: number; // Line index excluding blank lines (0-based)
  wordAtCursor: string; // Word at or near cursor for fine positioning
  offsetInWord: number; // Character offset within the word
}

interface EditorState {
  content: string;
  savedContent: string;
  filePath: string | null;
  isDirty: boolean;
  focusModeEnabled: boolean;
  typewriterModeEnabled: boolean;
  sourceMode: boolean;
  wordWrap: boolean;
  documentId: number; // Increments on new document to force editor recreation
  cursorInfo: CursorInfo | null; // Cursor position for syncing between modes
}

interface EditorActions {
  setContent: (content: string) => void;
  loadContent: (content: string, filePath?: string | null) => void;
  setFilePath: (path: string | null) => void;
  markSaved: () => void;
  toggleFocusMode: () => void;
  toggleTypewriterMode: () => void;
  toggleSourceMode: () => void;
  toggleWordWrap: () => void;
  setCursorInfo: (info: CursorInfo | null) => void;
  reset: () => void;
}

const initialState: EditorState = {
  content: "",
  savedContent: "",
  filePath: null,
  isDirty: false,
  focusModeEnabled: false,
  typewriterModeEnabled: false,
  sourceMode: false,
  wordWrap: true,
  documentId: 0,
  cursorInfo: null,
};

export const useEditorStore = create<EditorState & EditorActions>((set) => ({
  ...initialState,

  setContent: (content) =>
    set((state) => ({
      content,
      isDirty: state.savedContent !== content,
    })),

  loadContent: (content, filePath) =>
    set((state) => ({
      content,
      savedContent: content,
      filePath: filePath ?? null,
      isDirty: false,
      documentId: state.documentId + 1,
    })),

  setFilePath: (filePath) => set({ filePath }),

  markSaved: () =>
    set((state) => ({
      savedContent: state.content,
      isDirty: false,
    })),

  toggleFocusMode: () =>
    set((state) => ({ focusModeEnabled: !state.focusModeEnabled })),

  toggleTypewriterMode: () =>
    set((state) => ({ typewriterModeEnabled: !state.typewriterModeEnabled })),

  toggleSourceMode: () =>
    set((state) => ({ sourceMode: !state.sourceMode })),

  toggleWordWrap: () =>
    set((state) => ({ wordWrap: !state.wordWrap })),

  setCursorInfo: (cursorInfo) => set({ cursorInfo }),

  reset: () =>
    set((state) => ({
      ...initialState,
      documentId: state.documentId + 1,
    })),
}));
