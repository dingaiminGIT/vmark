/**
 * Tests for Visual Line Navigation
 *
 * - Visual line navigation (Up/Down with word wrap)
 * - Smart Home key (toggles between first non-whitespace and line start)
 */

import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { smartHome, smartHomeSelect } from "./visualLineNav";

// Track views for cleanup
const views: EditorView[] = [];

afterEach(() => {
  views.forEach((v) => v.destroy());
  views.length = 0;
});

/**
 * Create a CodeMirror EditorView with the given content and cursor position.
 * Cursor position is indicated by ^ in the content string.
 */
function createView(contentWithCursor: string): EditorView {
  const cursorPos = contentWithCursor.indexOf("^");
  const content = contentWithCursor.replace("^", "");

  const state = EditorState.create({
    doc: content,
    selection: { anchor: cursorPos },
  });

  const container = document.createElement("div");
  document.body.appendChild(container);
  const view = new EditorView({ state, parent: container });
  views.push(view);
  return view;
}

/**
 * Create a view with selection (anchor != head).
 */
function createViewWithSelection(content: string, anchor: number, head: number): EditorView {
  const state = EditorState.create({
    doc: content,
    selection: { anchor, head },
  });

  const container = document.createElement("div");
  document.body.appendChild(container);
  const view = new EditorView({ state, parent: container });
  views.push(view);
  return view;
}

describe("Smart Home key logic", () => {
  // Test the core algorithm that smartHome uses

  /**
   * Find first non-whitespace position in a line.
   * Returns the offset from line start.
   */
  function findFirstNonWhitespace(lineText: string): number {
    let firstNonWhitespace = 0;
    while (firstNonWhitespace < lineText.length && /\s/.test(lineText[firstNonWhitespace])) {
      firstNonWhitespace++;
    }
    return firstNonWhitespace;
  }

  /**
   * Determine target position for smart Home key.
   * @param cursorOffset - Current cursor offset in line
   * @param firstNonWhitespaceOffset - Offset of first non-whitespace char
   * @returns Target offset (0 for line start, or firstNonWhitespaceOffset)
   */
  function getSmartHomeTarget(cursorOffset: number, firstNonWhitespaceOffset: number): number {
    // If at first non-whitespace or at line start, toggle to the other
    if (cursorOffset === firstNonWhitespaceOffset) {
      return 0; // Go to line start
    }
    if (cursorOffset === 0) {
      return firstNonWhitespaceOffset; // Go to first non-whitespace
    }
    // Otherwise, go to first non-whitespace
    return firstNonWhitespaceOffset;
  }

  describe("findFirstNonWhitespace", () => {
    it("returns 0 for line starting with text", () => {
      expect(findFirstNonWhitespace("hello world")).toBe(0);
    });

    it("returns correct offset for indented line", () => {
      expect(findFirstNonWhitespace("  hello")).toBe(2);
      expect(findFirstNonWhitespace("    hello")).toBe(4);
      expect(findFirstNonWhitespace("\thello")).toBe(1);
    });

    it("returns line length for whitespace-only line", () => {
      expect(findFirstNonWhitespace("   ")).toBe(3);
      expect(findFirstNonWhitespace("")).toBe(0);
    });
  });

  describe("getSmartHomeTarget", () => {
    it("goes to line start when at first non-whitespace", () => {
      // Line: "  hello", cursor at position 2 (first 'h')
      expect(getSmartHomeTarget(2, 2)).toBe(0);
    });

    it("goes to first non-whitespace when at line start", () => {
      // Line: "  hello", cursor at position 0
      expect(getSmartHomeTarget(0, 2)).toBe(2);
    });

    it("goes to first non-whitespace when elsewhere in line", () => {
      // Line: "  hello", cursor at position 5 (middle of word)
      expect(getSmartHomeTarget(5, 2)).toBe(2);
    });

    it("handles non-indented line", () => {
      // Line: "hello", cursor at position 3
      expect(getSmartHomeTarget(3, 0)).toBe(0);
      // At first char (which is also first non-whitespace), go to 0 (same)
      expect(getSmartHomeTarget(0, 0)).toBe(0);
    });
  });
});

describe("smartHome with EditorView", () => {
  it("moves from middle of line to first non-whitespace", () => {
    const view = createView("  hel^lo");
    smartHome(view);
    expect(view.state.selection.main.head).toBe(2); // Position of 'h'
  });

  it("moves from first non-whitespace to line start", () => {
    const view = createView("  ^hello");
    smartHome(view);
    expect(view.state.selection.main.head).toBe(0); // Line start
  });

  it("moves from line start to first non-whitespace", () => {
    const view = createView("^  hello");
    smartHome(view);
    expect(view.state.selection.main.head).toBe(2); // Position of 'h'
  });

  it("handles non-indented line (stays at start)", () => {
    const view = createView("^hello");
    smartHome(view);
    // First non-whitespace is at 0, same as line start
    expect(view.state.selection.main.head).toBe(0);
  });

  it("handles cursor in middle of non-indented line", () => {
    const view = createView("hel^lo");
    smartHome(view);
    expect(view.state.selection.main.head).toBe(0);
  });

  it("handles whitespace-only line", () => {
    const view = createView("   ^");
    smartHome(view);
    // First non-whitespace position is line length (3), cursor was at 3
    // Should go to line start
    expect(view.state.selection.main.head).toBe(0);
  });

  it("handles tab indentation", () => {
    const view = createView("\thel^lo");
    smartHome(view);
    expect(view.state.selection.main.head).toBe(1); // After tab
  });

  it("handles multiline - works on current line", () => {
    const view = createView("line1\n  hel^lo\nline3");
    smartHome(view);
    // Line 2 starts at pos 6, first non-whitespace at pos 8
    expect(view.state.selection.main.head).toBe(8);
  });
});

describe("smartHomeSelect with EditorView", () => {
  it("extends selection from middle to first non-whitespace", () => {
    const view = createViewWithSelection("  hello", 5, 5); // Cursor at 'l'
    smartHomeSelect(view);
    const sel = view.state.selection.main;
    expect(sel.anchor).toBe(5); // Original anchor
    expect(sel.head).toBe(2); // First non-whitespace
  });

  it("extends selection from first non-whitespace to line start", () => {
    const view = createViewWithSelection("  hello", 2, 2); // At first non-whitespace
    smartHomeSelect(view);
    const sel = view.state.selection.main;
    expect(sel.anchor).toBe(2);
    expect(sel.head).toBe(0); // Line start
  });

  it("preserves existing selection anchor", () => {
    const view = createViewWithSelection("  hello", 3, 5); // Selection from pos 3 to 5
    smartHomeSelect(view);
    const sel = view.state.selection.main;
    expect(sel.anchor).toBe(3); // Original anchor preserved
    expect(sel.head).toBe(2); // First non-whitespace
  });

  it("handles extending to line start", () => {
    const view = createViewWithSelection("  hello", 0, 2); // Selection from start to first non-ws
    smartHomeSelect(view);
    const sel = view.state.selection.main;
    expect(sel.anchor).toBe(0);
    // Head was at first non-whitespace (2), should toggle to 0, but since
    // the logic checks head position, it would go to start
    // Actually the code: head === firstNonWhitespacePos => go to line.from (0)
    expect(sel.head).toBe(0);
  });
});
