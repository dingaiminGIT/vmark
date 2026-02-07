/**
 * Tests for Table Tab Navigation in Source Mode
 *
 * Tests the pure functions and integration with EditorView.
 */

import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  getCellBoundaries,
  goToNextCell,
  goToPreviousCell,
  isSourceTableFirstBlock,
  isSourceTableLastBlock,
  escapeTableUp,
  escapeTableDown,
} from "./tableTabNav";

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

describe("getCellBoundaries", () => {
  it("parses cells from a standard table row", () => {
    const cells = getCellBoundaries("| A | B | C |");
    expect(cells).toEqual([
      { from: 2, to: 3 },
      { from: 6, to: 7 },
      { from: 10, to: 11 },
    ]);
  });

  it("parses cells with varying content lengths", () => {
    const cells = getCellBoundaries("| Hello | World |");
    expect(cells).toEqual([
      { from: 2, to: 7 },
      { from: 10, to: 15 },
    ]);
  });

  it("parses separator row", () => {
    const cells = getCellBoundaries("|---|---|---|");
    // Separator cells have dashes as content
    expect(cells.length).toBe(3);
    expect(cells[0].from).toBeLessThan(cells[0].to);
  });

  it("handles row without leading pipe", () => {
    const cells = getCellBoundaries("A | B | C");
    expect(cells.length).toBe(3);
  });

  it("handles empty cells", () => {
    const cells = getCellBoundaries("|   |   |");
    // Empty cells still have boundaries
    expect(cells.length).toBeGreaterThan(0);
  });

  it("handles indented table row with leading whitespace", () => {
    const cells = getCellBoundaries("  | A | B |");
    expect(cells.length).toBe(2);
    // First cell "A" starts at offset 4 (2 ws + pipe + space)
    expect(cells[0].from).toBe(4);
    expect(cells[0].to).toBe(5);
  });

  it("handles trailing whitespace after last pipe", () => {
    const cells = getCellBoundaries("| A | B |   ");
    expect(cells.length).toBe(2);
    expect(cells[0]).toEqual({ from: 2, to: 3 });
    expect(cells[1]).toEqual({ from: 6, to: 7 });
  });
});

describe("goToNextCell", () => {
  it("moves cursor to next cell in same row", () => {
    // Cursor in first cell "A" (position 2)
    const view = createView(
      `| ^A | B | C |
|---|---|---|
| 1 | 2 | 3 |`
    );

    const handled = goToNextCell(view);
    expect(handled).toBe(true);

    // Check cursor moved to cell B
    const cursor = view.state.selection.main.from;
    const line = view.state.doc.lineAt(cursor);
    const posInLine = cursor - line.from;
    // Position should be around 6 (start of B cell content)
    expect(posInLine).toBeGreaterThan(3);
    expect(posInLine).toBeLessThan(10);
  });

  it("returns false when cursor is not in a table", () => {
    const view = createView(`This is ^plain text.`);
    const handled = goToNextCell(view);
    expect(handled).toBe(false);
  });

  it("skips separator row when navigating", () => {
    // Cursor at last cell of header row
    const view = createView(
      `| A | B | ^C |
|---|---|---|
| 1 | 2 | 3 |`
    );

    const handled = goToNextCell(view);
    expect(handled).toBe(true);

    // Should move to data row, not separator
    const cursor = view.state.selection.main.from;
    const line = view.state.doc.lineAt(cursor);
    // Should be in the "| 1 | 2 | 3 |" line
    expect(line.text).toContain("1");
  });
});

describe("goToPreviousCell", () => {
  it("moves cursor to previous cell in same row", () => {
    // Cursor in second cell "B"
    const view = createView(
      `| A | ^B | C |
|---|---|---|
| 1 | 2 | 3 |`
    );

    const handled = goToPreviousCell(view);
    expect(handled).toBe(true);

    // Check cursor moved to cell A
    const cursor = view.state.selection.main.from;
    const line = view.state.doc.lineAt(cursor);
    const posInLine = cursor - line.from;
    // Position should be around 2 (start of A cell content)
    expect(posInLine).toBeLessThan(5);
  });

  it("returns false when cursor is not in a table", () => {
    const view = createView(`This is ^plain text.`);
    const handled = goToPreviousCell(view);
    expect(handled).toBe(false);
  });

  it("skips separator row when navigating backwards", () => {
    // Cursor at first cell of data row
    const view = createView(
      `| A | B | C |
|---|---|---|
| ^1 | 2 | 3 |`
    );

    const handled = goToPreviousCell(view);
    expect(handled).toBe(true);

    // Should move to header row, not separator
    const cursor = view.state.selection.main.from;
    const line = view.state.doc.lineAt(cursor);
    // Should be in the "| A | B | C |" line
    expect(line.text).toContain("A");
  });
});

describe("isSourceTableFirstBlock", () => {
  it("returns true when tableStart is 0", () => {
    expect(isSourceTableFirstBlock(0)).toBe(true);
  });

  it("returns false when tableStart is greater than 0", () => {
    expect(isSourceTableFirstBlock(10)).toBe(false);
    expect(isSourceTableFirstBlock(1)).toBe(false);
  });
});

describe("isSourceTableLastBlock", () => {
  it("returns true when table ends at document end", () => {
    expect(isSourceTableLastBlock(50, 50)).toBe(true);
  });

  it("returns false when there is content after table", () => {
    expect(isSourceTableLastBlock(50, 100)).toBe(false);
  });
});

describe("escapeTableUp", () => {
  it("inserts paragraph when at first row of first-block table", () => {
    // Table is the first block (starts at position 0)
    const view = createView(
      `| ^A | B | C |
|---|---|---|
| 1 | 2 | 3 |`
    );

    const handled = escapeTableUp(view);
    expect(handled).toBe(true);

    // Check that a newline was inserted before
    const doc = view.state.doc.toString();
    expect(doc.startsWith("\n")).toBe(true);

    // Cursor should be at position 0
    expect(view.state.selection.main.from).toBe(0);
  });

  it("returns false when not at first row", () => {
    const view = createView(
      `| A | B | C |
|---|---|---|
| ^1 | 2 | 3 |`
    );

    const handled = escapeTableUp(view);
    expect(handled).toBe(false);
  });

  it("returns false when table is not first block", () => {
    const view = createView(
      `Some text before

| ^A | B | C |
|---|---|---|
| 1 | 2 | 3 |`
    );

    const handled = escapeTableUp(view);
    expect(handled).toBe(false);
  });

  it("returns false when not in a table", () => {
    const view = createView(`^Plain text`);
    const handled = escapeTableUp(view);
    expect(handled).toBe(false);
  });
});

describe("escapeTableDown", () => {
  it("inserts paragraph when at last row of last-block table", () => {
    // Table is the last block
    const view = createView(
      `| A | B | C |
|---|---|---|
| ^1 | 2 | 3 |`
    );

    const handled = escapeTableDown(view);
    expect(handled).toBe(true);

    // Check that a newline was inserted after
    const doc = view.state.doc.toString();
    expect(doc.endsWith("\n")).toBe(true);
  });

  it("returns false when not at last row", () => {
    const view = createView(
      `| ^A | B | C |
|---|---|---|
| 1 | 2 | 3 |`
    );

    const handled = escapeTableDown(view);
    expect(handled).toBe(false);
  });

  it("returns false when table is not last block", () => {
    const view = createView(
      `| A | B | C |
|---|---|---|
| ^1 | 2 | 3 |

Some text after`
    );

    const handled = escapeTableDown(view);
    expect(handled).toBe(false);
  });

  it("returns false when not in a table", () => {
    const view = createView(`^Plain text`);
    const handled = escapeTableDown(view);
    expect(handled).toBe(false);
  });
});
