import { create } from "zustand";

// Node types for cursor sync
export type NodeType =
  | "paragraph"
  | "heading"
  | "list_item"
  | "code_block"
  | "table_cell"
  | "blockquote";

// Cursor position info for syncing between editors
export interface CursorInfo {
  contentLineIndex: number;
  wordAtCursor: string;
  offsetInWord: number;
  nodeType: NodeType;
  percentInLine: number;
  contextBefore: string;
  contextAfter: string;
}

// Per-tab document state
export interface DocumentState {
  content: string;
  savedContent: string;
  filePath: string | null;
  isDirty: boolean;
  documentId: number;
  cursorInfo: CursorInfo | null;
  lastAutoSave: number | null;
}

interface DocumentStore {
  // Documents keyed by tab ID (changed from window label)
  documents: Record<string, DocumentState>;

  // Actions - now take tabId instead of windowLabel
  initDocument: (tabId: string, content?: string, filePath?: string | null) => void;
  setContent: (tabId: string, content: string) => void;
  loadContent: (tabId: string, content: string, filePath?: string | null) => void;
  setFilePath: (tabId: string, path: string | null) => void;
  markSaved: (tabId: string) => void;
  markAutoSaved: (tabId: string) => void;
  setCursorInfo: (tabId: string, info: CursorInfo | null) => void;
  removeDocument: (tabId: string) => void;

  // Selectors
  getDocument: (tabId: string) => DocumentState | undefined;
  getAllDirtyDocuments: () => string[]; // Returns tabIds
}

const createInitialDocument = (content = "", filePath: string | null = null): DocumentState => ({
  content,
  savedContent: content,
  filePath,
  isDirty: false,
  documentId: 0,
  cursorInfo: null,
  lastAutoSave: null,
});

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: {},

  initDocument: (tabId, content = "", filePath = null) =>
    set((state) => ({
      documents: {
        ...state.documents,
        [tabId]: createInitialDocument(content, filePath),
      },
    })),

  setContent: (tabId, content) =>
    set((state) => {
      const doc = state.documents[tabId];
      if (!doc) return state;
      return {
        documents: {
          ...state.documents,
          [tabId]: {
            ...doc,
            content,
            isDirty: doc.savedContent !== content,
          },
        },
      };
    }),

  loadContent: (tabId, content, filePath) =>
    set((state) => {
      const doc = state.documents[tabId];
      if (!doc) return state;
      return {
        documents: {
          ...state.documents,
          [tabId]: {
            ...doc,
            content,
            savedContent: content,
            filePath: filePath ?? null,
            isDirty: false,
            documentId: doc.documentId + 1,
          },
        },
      };
    }),

  setFilePath: (tabId, path) =>
    set((state) => {
      const doc = state.documents[tabId];
      if (!doc) return state;
      return {
        documents: {
          ...state.documents,
          [tabId]: { ...doc, filePath: path },
        },
      };
    }),

  markSaved: (tabId) =>
    set((state) => {
      const doc = state.documents[tabId];
      if (!doc) return state;
      return {
        documents: {
          ...state.documents,
          [tabId]: {
            ...doc,
            savedContent: doc.content,
            isDirty: false,
          },
        },
      };
    }),

  markAutoSaved: (tabId) =>
    set((state) => {
      const doc = state.documents[tabId];
      if (!doc) return state;
      return {
        documents: {
          ...state.documents,
          [tabId]: {
            ...doc,
            savedContent: doc.content,
            isDirty: false,
            lastAutoSave: Date.now(),
          },
        },
      };
    }),

  setCursorInfo: (tabId, info) =>
    set((state) => {
      const doc = state.documents[tabId];
      if (!doc) return state;
      return {
        documents: {
          ...state.documents,
          [tabId]: { ...doc, cursorInfo: info },
        },
      };
    }),

  removeDocument: (tabId) =>
    set((state) => {
      const { [tabId]: _, ...rest } = state.documents;
      return { documents: rest };
    }),

  getDocument: (tabId) => get().documents[tabId],

  getAllDirtyDocuments: () => {
    const { documents } = get();
    return Object.entries(documents)
      .filter(([_, doc]) => doc.isDirty)
      .map(([tabId]) => tabId);
  },
}));
