/**
 * Multi-Cursor Tab Escape Tests for CodeMirror (Source Mode)
 *
 * Tests Tab escape behavior with multiple cursors/selections in Source mode.
 * CodeMirror has built-in multi-cursor support via EditorSelection.
 */

import { describe, it, expect, afterEach } from "vitest";
import { EditorState, EditorSelection, SelectionRange } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tabEscapeKeymap } from "./tabEscape";

const views: EditorView[] = [];

afterEach(() => {
  views.forEach((v) => v.destroy());
  views.length = 0;
});

function createView(content: string, ranges: { anchor: number; head?: number }[]): EditorView {
  const state = EditorState.create({
    doc: content,
    selection: EditorSelection.create(
      ranges.map((r) => EditorSelection.range(r.anchor, r.head ?? r.anchor))
    ),
  });

  const container = document.createElement("div");
  document.body.appendChild(container);
  const view = new EditorView({ state, parent: container });
  views.push(view);
  return view;
}

describe("CodeMirror Multi-Cursor Tab Escape", () => {
  describe("Current behavior with multiple cursors", () => {
    it("Tab with two cursors (not in links)", () => {
      const view = createView("hello world", [
        { anchor: 5 }, // After "hello"
        { anchor: 11 }, // After "world"
      ]);

      // EditorSelection.create() merges cursors at same position
      // and may drop some ranges - actual behavior varies
      // Just document what we observe
      const initialRanges = view.state.selection.ranges.length;

      const handled = tabEscapeKeymap.run!(view);

      // tabEscape checks: from !== to (single selection check)
      // With multi-cursor, it should return false (not handled)
      expect(handled).toBe(false);
    });

    it("Tab with cursor in link and cursor outside link", () => {
      const content = "[link](url) plain text";
      const view = createView(content, [
        { anchor: 3 }, // Inside "link"
        { anchor: 20 }, // In "plain text"
      ]);

      const handled = tabEscapeKeymap.run!(view);

      // Current implementation only checks primary selection (first range)
      // from !== to for first range → single cursor
      // But it's multi-cursor context!
    });

    it("Two cursors both in links", () => {
      const content = "[first](url1) and [second](url2)";
      const view = createView(content, [
        { anchor: 3 }, // In "first"
        { anchor: 21 }, // In "second"
      ]);

      const handled = tabEscapeKeymap.run!(view);

      // Expected: Both should navigate within their respective links
      // Actual: Undefined behavior
    });

    it("Two cursors in same link", () => {
      const content = "[long link text](url)";
      const view = createView(content, [
        { anchor: 2 }, // "long"
        { anchor: 7 }, // "link"
      ]);

      const handled = tabEscapeKeymap.run!(view);

      // Both in same link - should both jump to URL?
      // Or merge into single cursor?
    });

    it("Mixed: one cursor, one selection", () => {
      const view = createView("hello [link](url) world", [
        { anchor: 8 }, // Cursor in "link"
        { anchor: 18, head: 23 }, // Selection in "world"
      ]);

      const { main } = view.state.selection;
      const isSelection = main.from !== main.to;

      const handled = tabEscapeKeymap.run!(view);

      // tabEscape checks: from !== to
      // Behavior depends on which is primary range
      if (isSelection) {
        expect(handled).toBe(false);
      }
      // If cursor is primary, behavior varies
    });
  });

  describe("Tab before closing chars with multi-cursor", () => {
    it("Two cursors both before closing parens", () => {
      const view = createView("text) and more)", [
        { anchor: 4 }, // Before first )
        { anchor: 14 }, // Before second )
      ]);

      const handled = tabEscapeKeymap.run!(view);

      // Expected: Both cursors jump over their respective )
      // Actual: Only first cursor handled? Or undefined?
    });

    it("One cursor before ), one in plain text", () => {
      const view = createView("text) plain", [
        { anchor: 4 }, // Before )
        { anchor: 8 }, // In "plain"
      ]);

      const handled = tabEscapeKeymap.run!(view);

      // Expected: First cursor jumps, second stays
      // Actual: Undefined
    });

    it("Before different closing chars", () => {
      const view = createView("text) and more]", [
        { anchor: 4 }, // Before )
        { anchor: 14 }, // Before ]
      ]);

      const handled = tabEscapeKeymap.run!(view);

      // Both should jump over their respective closing chars
    });
  });

  describe("Integration with fallback Tab indent", () => {
    it("documents expected fallback behavior", () => {
      // When tabEscape returns false (not handled),
      // control falls through to tabIndentFallbackKeymap
      //
      // The fallback DOES support multi-cursor:
      // CodeMirror's built-in indentMore/indentLess handle multiple ranges
      //
      // So current behavior:
      // - tabEscape: Only works with single cursor (returns false for multi)
      // - Falls through to indent: Inserts spaces at all cursor positions
      //
      // This is actually reasonable UX, but not explicitly designed
    });
  });
});

describe("Edge cases and design considerations", () => {
  describe("Link navigation with multi-cursor", () => {
    it("scenario: cursors at different positions in link lifecycle", () => {
      // [text|1] |(url|2)
      //       ^1 ^2  ^3
      //
      // Cursor 1: in text → should jump to URL
      // Cursor 2: between ] and ( → should jump to URL (or outside?)
      // Cursor 3: in URL → should jump outside
      //
      // Expected: Each cursor follows its natural progression
    });

    it("scenario: overlapping ranges in same link", () => {
      // [te|xt|](url)
      //    ^1 ^2
      //
      // Two cursors in [text] portion
      // Both should jump to (url)?
      // Or merge into one cursor?
    });
  });

  describe("Closing char navigation with multi-cursor", () => {
    it("scenario: sequential closing chars", () => {
      // text|)|]|}
      //     ^1^2^3
      //
      // Three cursors before ), ], }
      // Each should jump over its respective char
    });

    it("scenario: before multi-char sequence", () => {
      // text|~~ and more|==
      //     ^1          ^2
      //
      // Cursor 1 before ~~ → jump 2 positions
      // Cursor 2 before == → jump 2 positions
    });
  });

  describe("Recommended behavior", () => {
    it("Option 1: Handle each cursor/range independently", () => {
      // Check each range in the selection:
      // - If cursor before closing char: jump over
      // - If cursor in link: navigate within link
      // - Otherwise: no action for this cursor
      //
      // Apply all valid jumps, keep others unchanged
      //
      // This is most powerful but requires comprehensive implementation
    });

    it("Option 2: Only handle if primary cursor can escape", () => {
      // Check only selection.main (primary):
      // - If can escape: apply to primary only
      // - Secondary cursors unchanged
      //
      // Simple but asymmetric
    });

    it("Option 3: Disable for multi-cursor (current)", () => {
      // Return false when ranges.length > 1
      // Falls through to indent (insert spaces at all positions)
      //
      // Current behavior (by accident)
      // Clear and predictable
    });
  });
});

describe("Implementation notes", () => {
  it("CodeMirror selection model", () => {
    // EditorSelection has:
    // - ranges: array of SelectionRange
    // - main: primary range (usually last in array)
    //
    // Each SelectionRange has:
    // - from: start position (min of anchor/head)
    // - to: end position (max of anchor/head)
    // - anchor: where selection started
    // - head: where cursor is (can be before or after anchor)
    //
    // When from === to: cursor (no selection)
    // When from !== to: selection
  });

  it("Current tabEscape implementation", () => {
    // tabEscape.ts checks:
    //   if (from !== to) return false;
    //
    // This uses selection.main:
    //   const { from, to } = state.selection.main;
    //
    // So it ONLY checks primary range!
    // Other ranges are ignored completely
  });

  it("Potential fix locations", () => {
    // 1. tabEscape.ts: Add multi-range support
    //    Loop over state.selection.ranges
    //    Check each for link/closing char
    //    Build transaction with all jumps
    //
    // 2. tabEscapeLink.ts: Similar approach
    //    For each range, check if in link
    //    Calculate jump positions for all
    //    Dispatch with updated ranges
    //
    // 3. Guard clause: Explicit multi-cursor check
    //    if (state.selection.ranges.length > 1) return false;
    //    Document this as intentional limitation
  });
});
