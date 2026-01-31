/**
 * Tests for Tab Escape Link Navigation in Source Mode
 *
 * Tests Tab navigation within markdown links:
 * - From [text] to (url)
 * - From (url) to outside the link
 */

import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  isInLinkText,
  isInLinkUrl,
  getLinkBoundaries,
  tabNavigateLink,
} from "./tabEscapeLink";

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

describe("getLinkBoundaries", () => {
  it("finds link boundaries for standard link", () => {
    const text = "Hello [link text](https://example.com) world";
    const boundaries = getLinkBoundaries(text, 10); // cursor inside "link text"
    expect(boundaries).not.toBeNull();
    expect(boundaries?.textStart).toBe(7); // after [
    expect(boundaries?.textEnd).toBe(16); // before ]
    expect(boundaries?.urlStart).toBe(18); // after (
    expect(boundaries?.urlEnd).toBe(37); // before )
    expect(boundaries?.linkEnd).toBe(38); // after )
  });

  it("finds link boundaries when cursor is in URL", () => {
    const text = "[text](^https://example.com)";
    const boundaries = getLinkBoundaries(text, 7);
    expect(boundaries).not.toBeNull();
    expect(boundaries?.urlStart).toBe(7);
  });

  it("returns null when no link at cursor", () => {
    const text = "Plain text without links";
    const boundaries = getLinkBoundaries(text, 5);
    expect(boundaries).toBeNull();
  });

  it("handles link with title", () => {
    const text = '[text](url "title")';
    const boundaries = getLinkBoundaries(text, 3);
    expect(boundaries).not.toBeNull();
    expect(boundaries?.linkEnd).toBe(19);
  });

  it("handles nested brackets in text", () => {
    // Now supported with balanced bracket parsing
    const text = "[text [nested]](url)";
    const boundaries = getLinkBoundaries(text, 8); // Inside "nested"
    expect(boundaries).not.toBeNull();
    expect(boundaries?.textStart).toBe(1);
    expect(boundaries?.textEnd).toBe(14); // Position of final ]
    expect(boundaries?.urlStart).toBe(16); // After (
    expect(boundaries?.linkEnd).toBe(20); // After )
  });

  it("handles escaped brackets in text", () => {
    // Escaped brackets should be treated as literal characters
    const text = "[text \\[bracket\\]](url)";
    const boundaries = getLinkBoundaries(text, 8); // Inside "bracket"
    expect(boundaries).not.toBeNull();
    expect(boundaries?.textStart).toBe(1);
    expect(boundaries?.textEnd).toBe(17); // Position of ]
    expect(boundaries?.linkEnd).toBe(23);
  });

  it("handles nested parentheses in URL", () => {
    // URLs can contain balanced parentheses
    const text = "[link](https://example.com/page(params))";
    const boundaries = getLinkBoundaries(text, 3);
    expect(boundaries).not.toBeNull();
    expect(boundaries?.urlStart).toBe(7);
    expect(boundaries?.urlEnd).toBe(39); // Position of final )
    expect(boundaries?.linkEnd).toBe(40);
  });

  it("handles multiple levels of nesting", () => {
    // Deep nesting: [a [b [c]]]
    const text = "[outer [middle [inner]]](url)";
    const boundaries = getLinkBoundaries(text, 18); // Inside "inner"
    expect(boundaries).not.toBeNull();
    expect(boundaries?.textStart).toBe(1);
    expect(boundaries?.textEnd).toBe(23); // Position of final ]
    expect(boundaries?.linkEnd).toBe(29);
  });

  it("handles escaped brackets with nested real brackets", () => {
    // Mix of escaped and real brackets: [text \[esc\] [real]]
    const text = "[text \\[esc\\] [real]](url)";
    const boundaries = getLinkBoundaries(text, 15); // Inside "real"
    expect(boundaries).not.toBeNull();
    expect(boundaries?.textStart).toBe(1);
    expect(boundaries?.textEnd).toBe(20);
  });

  it("handles link not at start of line", () => {
    // Link in middle of text
    const text = "Some text [link [nested]](url) more text";
    const boundaries = getLinkBoundaries(text, 18); // Inside "nested"
    expect(boundaries).not.toBeNull();
    expect(boundaries?.textStart).toBe(11);
    expect(boundaries?.textEnd).toBe(24);
  });
});

describe("isInLinkText", () => {
  it("returns true when cursor is inside link text", () => {
    const text = "[link text](url)";
    const boundaries = getLinkBoundaries(text, 3);
    expect(isInLinkText(boundaries!, 3)).toBe(true);
  });

  it("returns false when cursor is in URL", () => {
    const text = "[text](https://url)";
    const boundaries = getLinkBoundaries(text, 10);
    expect(isInLinkText(boundaries!, 10)).toBe(false);
  });

  it("returns true at start of text", () => {
    const text = "[text](url)";
    const boundaries = getLinkBoundaries(text, 1);
    expect(isInLinkText(boundaries!, 1)).toBe(true);
  });

  it("returns true at end of text", () => {
    const text = "[text](url)";
    const boundaries = getLinkBoundaries(text, 5);
    expect(isInLinkText(boundaries!, 5)).toBe(true);
  });
});

describe("isInLinkUrl", () => {
  it("returns true when cursor is inside URL", () => {
    const text = "[text](https://url)";
    const boundaries = getLinkBoundaries(text, 12);
    expect(isInLinkUrl(boundaries!, 12)).toBe(true);
  });

  it("returns false when cursor is in text", () => {
    const text = "[link text](url)";
    const boundaries = getLinkBoundaries(text, 3);
    expect(isInLinkUrl(boundaries!, 3)).toBe(false);
  });

  it("returns true at start of URL", () => {
    const text = "[text](url)";
    const boundaries = getLinkBoundaries(text, 7);
    expect(isInLinkUrl(boundaries!, 7)).toBe(true);
  });

  it("returns true at end of URL", () => {
    const text = "[text](url)";
    const boundaries = getLinkBoundaries(text, 10);
    expect(isInLinkUrl(boundaries!, 10)).toBe(true);
  });
});

describe("tabNavigateLink", () => {
  it("moves cursor from link text to URL start", () => {
    const view = createView("[link ^text](https://example.com)");

    const handled = tabNavigateLink(view);
    expect(handled).toBe(true);

    // Cursor should be at start of URL (after the opening paren)
    const cursor = view.state.selection.main.from;
    const doc = view.state.doc.toString();
    expect(doc.charAt(cursor)).toBe("h"); // First char of "https"
  });

  it("moves cursor from URL to after link", () => {
    const view = createView("[text](https://example^.com)");

    const handled = tabNavigateLink(view);
    expect(handled).toBe(true);

    // Cursor should be after the closing paren
    const cursor = view.state.selection.main.from;
    const doc = view.state.doc.toString();
    expect(cursor).toBe(doc.indexOf(")") + 1);
  });

  it("returns false when not in a link", () => {
    const view = createView("Plain ^text without links");

    const handled = tabNavigateLink(view);
    expect(handled).toBe(false);
  });

  it("handles link at start of line", () => {
    const view = createView("[^text](url)");

    const handled = tabNavigateLink(view);
    expect(handled).toBe(true);

    const cursor = view.state.selection.main.from;
    const doc = view.state.doc.toString();
    expect(doc.charAt(cursor)).toBe("u"); // First char of "url"
  });

  it("handles link at end of line", () => {
    // "Text [link](url)" - 16 chars, cursor inside "url"
    const view = createView("Text [link](ur^l)");

    const handled = tabNavigateLink(view);
    expect(handled).toBe(true);

    const cursor = view.state.selection.main.from;
    // After removing ^: "Text [link](url)" is 16 chars
    // ) is at index 15, so after ) is index 16
    expect(cursor).toBe(16); // After the closing paren
  });

  it("handles empty link text", () => {
    const view = createView("[^](url)");

    const handled = tabNavigateLink(view);
    expect(handled).toBe(true);

    const cursor = view.state.selection.main.from;
    const doc = view.state.doc.toString();
    expect(doc.charAt(cursor)).toBe("u");
  });

  it("handles empty URL", () => {
    const view = createView("[text](^)");

    const handled = tabNavigateLink(view);
    expect(handled).toBe(true);

    const cursor = view.state.selection.main.from;
    expect(cursor).toBe(8); // After )
  });

  it("ignores selection (only handles cursor)", () => {
    // Simulate a selection by setting different anchor and head
    const content = "[link text](url)";
    const state = EditorState.create({
      doc: content,
      selection: { anchor: 1, head: 5 }, // Selection from l to k
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const view = new EditorView({ state, parent: container });
    views.push(view);

    const handled = tabNavigateLink(view);
    expect(handled).toBe(false); // Should not handle selections
  });

  it("works with multiple links - uses link containing cursor", () => {
    const view = createView("[first](url1) and [sec^ond](url2)");

    const handled = tabNavigateLink(view);
    expect(handled).toBe(true);

    const cursor = view.state.selection.main.from;
    const doc = view.state.doc.toString();
    // Should move to url2, not url1
    expect(doc.substring(cursor, cursor + 4)).toBe("url2");
  });
});
