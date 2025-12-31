import { describe, it, expect, beforeEach } from "vitest";
import { useDocumentStore } from "./documentStore";

describe("documentStore", () => {
  const WINDOW_LABEL = "test-window";

  beforeEach(() => {
    // Clear all documents before each test
    const store = useDocumentStore.getState();
    Object.keys(store.documents).forEach((label) => {
      store.removeDocument(label);
    });
  });

  describe("initDocument", () => {
    it("creates a new document with default values", () => {
      const { initDocument, getDocument } = useDocumentStore.getState();

      initDocument(WINDOW_LABEL);

      const doc = getDocument(WINDOW_LABEL);
      expect(doc).toBeDefined();
      expect(doc?.content).toBe("");
      expect(doc?.savedContent).toBe("");
      expect(doc?.filePath).toBeNull();
      expect(doc?.isDirty).toBe(false);
      expect(doc?.documentId).toBe(0);
      expect(doc?.cursorInfo).toBeNull();
      expect(doc?.lastAutoSave).toBeNull();
    });

    it("creates a document with initial content", () => {
      const { initDocument, getDocument } = useDocumentStore.getState();

      initDocument(WINDOW_LABEL, "# Hello World");

      const doc = getDocument(WINDOW_LABEL);
      expect(doc?.content).toBe("# Hello World");
      expect(doc?.savedContent).toBe("# Hello World");
      expect(doc?.isDirty).toBe(false);
    });

    it("creates a document with initial content and filePath", () => {
      const { initDocument, getDocument } = useDocumentStore.getState();

      initDocument(WINDOW_LABEL, "# Test", "/path/to/file.md");

      const doc = getDocument(WINDOW_LABEL);
      expect(doc?.content).toBe("# Test");
      expect(doc?.filePath).toBe("/path/to/file.md");
    });
  });

  describe("setContent", () => {
    it("updates content and marks dirty when content differs from saved", () => {
      const { initDocument, setContent, getDocument } = useDocumentStore.getState();

      initDocument(WINDOW_LABEL, "Original");
      setContent(WINDOW_LABEL, "Modified");

      const doc = getDocument(WINDOW_LABEL);
      expect(doc?.content).toBe("Modified");
      expect(doc?.isDirty).toBe(true);
    });

    it("does not mark dirty when content matches saved content", () => {
      const { initDocument, setContent, getDocument } = useDocumentStore.getState();

      initDocument(WINDOW_LABEL, "Same content");
      setContent(WINDOW_LABEL, "Same content");

      const doc = getDocument(WINDOW_LABEL);
      expect(doc?.isDirty).toBe(false);
    });

    it("does nothing for non-existent window", () => {
      const { setContent, getDocument } = useDocumentStore.getState();

      setContent("non-existent", "content");

      expect(getDocument("non-existent")).toBeUndefined();
    });
  });

  describe("loadContent", () => {
    it("loads content and resets dirty state", () => {
      const { initDocument, setContent, loadContent, getDocument } = useDocumentStore.getState();

      initDocument(WINDOW_LABEL, "Initial");
      setContent(WINDOW_LABEL, "Dirty content");
      expect(getDocument(WINDOW_LABEL)?.isDirty).toBe(true);

      loadContent(WINDOW_LABEL, "Loaded content", "/new/path.md");

      const doc = getDocument(WINDOW_LABEL);
      expect(doc?.content).toBe("Loaded content");
      expect(doc?.savedContent).toBe("Loaded content");
      expect(doc?.filePath).toBe("/new/path.md");
      expect(doc?.isDirty).toBe(false);
    });

    it("increments documentId on load", () => {
      const { initDocument, loadContent, getDocument } = useDocumentStore.getState();

      initDocument(WINDOW_LABEL);
      expect(getDocument(WINDOW_LABEL)?.documentId).toBe(0);

      loadContent(WINDOW_LABEL, "New content");
      expect(getDocument(WINDOW_LABEL)?.documentId).toBe(1);

      loadContent(WINDOW_LABEL, "Another content");
      expect(getDocument(WINDOW_LABEL)?.documentId).toBe(2);
    });
  });

  describe("setFilePath", () => {
    it("updates the file path", () => {
      const { initDocument, setFilePath, getDocument } = useDocumentStore.getState();

      initDocument(WINDOW_LABEL);
      setFilePath(WINDOW_LABEL, "/updated/path.md");

      expect(getDocument(WINDOW_LABEL)?.filePath).toBe("/updated/path.md");
    });
  });

  describe("markSaved", () => {
    it("clears the dirty flag", () => {
      const { initDocument, setContent, markSaved, getDocument } = useDocumentStore.getState();

      initDocument(WINDOW_LABEL, "Initial");
      setContent(WINDOW_LABEL, "Modified");
      expect(getDocument(WINDOW_LABEL)?.isDirty).toBe(true);

      markSaved(WINDOW_LABEL);

      const doc = getDocument(WINDOW_LABEL);
      expect(doc?.isDirty).toBe(false);
      expect(doc?.savedContent).toBe("Modified");
    });
  });

  describe("markAutoSaved", () => {
    it("clears dirty flag and sets lastAutoSave timestamp", () => {
      const { initDocument, setContent, markAutoSaved, getDocument } = useDocumentStore.getState();

      initDocument(WINDOW_LABEL, "Initial");
      setContent(WINDOW_LABEL, "Modified");

      const beforeTime = Date.now();
      markAutoSaved(WINDOW_LABEL);
      const afterTime = Date.now();

      const doc = getDocument(WINDOW_LABEL);
      expect(doc?.isDirty).toBe(false);
      expect(doc?.lastAutoSave).toBeGreaterThanOrEqual(beforeTime);
      expect(doc?.lastAutoSave).toBeLessThanOrEqual(afterTime);
    });
  });

  describe("setCursorInfo", () => {
    it("updates cursor info", () => {
      const { initDocument, setCursorInfo, getDocument } = useDocumentStore.getState();

      initDocument(WINDOW_LABEL);

      const cursorInfo = {
        contentLineIndex: 5,
        wordAtCursor: "test",
        offsetInWord: 2,
        nodeType: "paragraph" as const,
        percentInLine: 0.5,
        contextBefore: "abc",
        contextAfter: "xyz",
      };

      setCursorInfo(WINDOW_LABEL, cursorInfo);

      expect(getDocument(WINDOW_LABEL)?.cursorInfo).toEqual(cursorInfo);
    });

    it("can clear cursor info with null", () => {
      const { initDocument, setCursorInfo, getDocument } = useDocumentStore.getState();

      initDocument(WINDOW_LABEL);
      setCursorInfo(WINDOW_LABEL, {
        contentLineIndex: 0,
        wordAtCursor: "",
        offsetInWord: 0,
        nodeType: "paragraph",
        percentInLine: 0,
        contextBefore: "",
        contextAfter: "",
      });

      setCursorInfo(WINDOW_LABEL, null);

      expect(getDocument(WINDOW_LABEL)?.cursorInfo).toBeNull();
    });
  });

  describe("removeDocument", () => {
    it("removes the document from the store", () => {
      const { initDocument, removeDocument, getDocument } = useDocumentStore.getState();

      initDocument(WINDOW_LABEL);
      expect(getDocument(WINDOW_LABEL)).toBeDefined();

      removeDocument(WINDOW_LABEL);

      expect(getDocument(WINDOW_LABEL)).toBeUndefined();
    });
  });

  describe("getAllDirtyWindows", () => {
    it("returns all window labels with dirty documents", () => {
      const { initDocument, setContent, getAllDirtyWindows } = useDocumentStore.getState();

      initDocument("window-1", "Content 1");
      initDocument("window-2", "Content 2");
      initDocument("window-3", "Content 3");

      setContent("window-1", "Modified 1");
      setContent("window-3", "Modified 3");

      const dirtyWindows = getAllDirtyWindows();
      expect(dirtyWindows).toHaveLength(2);
      expect(dirtyWindows).toContain("window-1");
      expect(dirtyWindows).toContain("window-3");
      expect(dirtyWindows).not.toContain("window-2");
    });

    it("returns empty array when no documents are dirty", () => {
      const { initDocument, getAllDirtyWindows } = useDocumentStore.getState();

      initDocument("window-1");
      initDocument("window-2");

      expect(getAllDirtyWindows()).toHaveLength(0);
    });
  });

  describe("multiple windows", () => {
    it("maintains separate state for each window", () => {
      const { initDocument, setContent, getDocument } = useDocumentStore.getState();

      initDocument("window-1", "Content A");
      initDocument("window-2", "Content B");

      setContent("window-1", "Modified A");

      expect(getDocument("window-1")?.content).toBe("Modified A");
      expect(getDocument("window-1")?.isDirty).toBe(true);
      expect(getDocument("window-2")?.content).toBe("Content B");
      expect(getDocument("window-2")?.isDirty).toBe(false);
    });
  });
});
