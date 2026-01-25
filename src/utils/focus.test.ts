import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isTerminalFocused, isEditorFocused, getFocusContext } from "./focus";

describe("focus", () => {
  // Helper to create a mock element with closest() behavior
  function createMockElement(closestResults: Record<string, boolean>): Element {
    return {
      closest: vi.fn((selector: string) => {
        return closestResults[selector] ? {} : null;
      }),
    } as unknown as Element;
  }

  beforeEach(() => {
    // No setup needed - mocks are applied per test
  });

  afterEach(() => {
    // Reset activeElement by focusing body
    if (document.body) {
      document.body.focus();
    }
    vi.restoreAllMocks();
  });

  describe("isTerminalFocused", () => {
    it("returns true when activeElement is in terminal", () => {
      const mockElement = createMockElement({ ".terminal-view": true });
      vi.spyOn(document, "activeElement", "get").mockReturnValue(mockElement);

      expect(isTerminalFocused()).toBe(true);
    });

    it("returns false when activeElement is not in terminal", () => {
      const mockElement = createMockElement({ ".terminal-view": false });
      vi.spyOn(document, "activeElement", "get").mockReturnValue(mockElement);

      expect(isTerminalFocused()).toBe(false);
    });

    it("returns false when no activeElement", () => {
      vi.spyOn(document, "activeElement", "get").mockReturnValue(null);

      expect(isTerminalFocused()).toBe(false);
    });

    it("returns false when activeElement is in editor", () => {
      const mockElement = createMockElement({
        ".terminal-view": false,
        ".ProseMirror": true,
      });
      vi.spyOn(document, "activeElement", "get").mockReturnValue(mockElement);

      expect(isTerminalFocused()).toBe(false);
    });
  });

  describe("isEditorFocused", () => {
    it("returns true for WYSIWYG editor (.ProseMirror)", () => {
      const mockElement = createMockElement({ ".ProseMirror": true, ".cm-editor": false });
      vi.spyOn(document, "activeElement", "get").mockReturnValue(mockElement);

      expect(isEditorFocused()).toBe(true);
    });

    it("returns true for Source editor (.cm-editor)", () => {
      const mockElement = createMockElement({ ".ProseMirror": false, ".cm-editor": true });
      vi.spyOn(document, "activeElement", "get").mockReturnValue(mockElement);

      expect(isEditorFocused()).toBe(true);
    });

    it("returns true when in both editors (edge case)", () => {
      const mockElement = createMockElement({ ".ProseMirror": true, ".cm-editor": true });
      vi.spyOn(document, "activeElement", "get").mockReturnValue(mockElement);

      expect(isEditorFocused()).toBe(true);
    });

    it("returns false for other elements", () => {
      const mockElement = createMockElement({
        ".ProseMirror": false,
        ".cm-editor": false,
        ".sidebar": true,
      });
      vi.spyOn(document, "activeElement", "get").mockReturnValue(mockElement);

      expect(isEditorFocused()).toBe(false);
    });

    it("returns false when no activeElement", () => {
      vi.spyOn(document, "activeElement", "get").mockReturnValue(null);

      expect(isEditorFocused()).toBe(false);
    });

    it("returns false for terminal", () => {
      const mockElement = createMockElement({
        ".ProseMirror": false,
        ".cm-editor": false,
        ".terminal-view": true,
      });
      vi.spyOn(document, "activeElement", "get").mockReturnValue(mockElement);

      expect(isEditorFocused()).toBe(false);
    });
  });

  describe("getFocusContext", () => {
    it("returns 'terminal' when terminal focused", () => {
      const mockElement = createMockElement({
        ".terminal-view": true,
        ".ProseMirror": false,
        ".cm-editor": false,
      });
      vi.spyOn(document, "activeElement", "get").mockReturnValue(mockElement);

      expect(getFocusContext()).toBe("terminal");
    });

    it("returns 'editor' when WYSIWYG editor focused", () => {
      const mockElement = createMockElement({
        ".terminal-view": false,
        ".ProseMirror": true,
        ".cm-editor": false,
      });
      vi.spyOn(document, "activeElement", "get").mockReturnValue(mockElement);

      expect(getFocusContext()).toBe("editor");
    });

    it("returns 'editor' when Source editor focused", () => {
      const mockElement = createMockElement({
        ".terminal-view": false,
        ".ProseMirror": false,
        ".cm-editor": true,
      });
      vi.spyOn(document, "activeElement", "get").mockReturnValue(mockElement);

      expect(getFocusContext()).toBe("editor");
    });

    it("returns 'other' when neither terminal nor editor focused", () => {
      const mockElement = createMockElement({
        ".terminal-view": false,
        ".ProseMirror": false,
        ".cm-editor": false,
      });
      vi.spyOn(document, "activeElement", "get").mockReturnValue(mockElement);

      expect(getFocusContext()).toBe("other");
    });

    it("returns 'other' when no activeElement", () => {
      vi.spyOn(document, "activeElement", "get").mockReturnValue(null);

      expect(getFocusContext()).toBe("other");
    });

    it("prioritizes terminal over editor (if somehow both match)", () => {
      // This is an edge case that shouldn't happen in practice
      const mockElement = createMockElement({
        ".terminal-view": true,
        ".ProseMirror": true,
        ".cm-editor": false,
      });
      vi.spyOn(document, "activeElement", "get").mockReturnValue(mockElement);

      // Terminal is checked first, so it should return 'terminal'
      expect(getFocusContext()).toBe("terminal");
    });
  });
});
