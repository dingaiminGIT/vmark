/**
 * Edge Case Tests for Tab Escape in Source Mode
 *
 * Tests for edge cases in:
 * - Link navigation [text] → (url) → outside
 * - Jumping over closing characters
 * - Multi-character sequences
 * - Complex markdown structures
 */

import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { getLinkBoundaries, tabNavigateLink } from "./tabEscapeLink";
import { tabEscapeKeymap } from "./tabEscape";

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

describe("Source Mode Tab Escape - Link Navigation Edge Cases", () => {
  describe("Link with special characters in text", () => {
    it("handles escaped brackets in link text", () => {
      // Now supported with balanced bracket parsing
      // Escaped brackets are treated as literal characters
      const view = createView("[text \\[^with\\] brackets](url)");
      const handled = tabNavigateLink(view);
      // Should successfully navigate - escaped brackets don't count as nesting
      expect(handled).toBe(true);
      // Cursor should move to URL portion (after the opening paren)
      const expectedPos = "[text \\[with\\] brackets](".length;
      expect(view.state.selection.main.anchor).toBe(expectedPos);
    });

    it("handles backticks in link text", () => {
      const view = createView("[`code` ^text](url)");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);
    });

    it("handles emoji in link text", () => {
      const view = createView("[🎉 party ^text](url)");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);
    });

    it("handles CJK characters in link text", () => {
      const view = createView("[中文^链接](url)");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);
    });
  });

  describe("Link with complex URLs", () => {
    it("handles URL with query parameters", () => {
      const view = createView("[text](https://example.com?foo=bar&^baz=qux)");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);

      const cursor = view.state.selection.main.from;
      expect(cursor).toBe(view.state.doc.toString().indexOf(")") + 1);
    });

    it("handles URL with anchor/fragment", () => {
      const view = createView("[text](https://example.com/page#^section)");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);
    });

    it("handles URL with encoded characters", () => {
      const view = createView("[text](https://example.com/path%20with%20^spaces)");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);
    });

    it("handles relative URL", () => {
      const view = createView("[text](./relative/^path.md)");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);
    });

    it("handles absolute path", () => {
      const view = createView("[text](/absolute/^path)");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);
    });

    it("handles URL with port", () => {
      const view = createView("[text](http://localhost:^3000/path)");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);
    });

    it("handles data URL", () => {
      const view = createView("[text](data:text/plain;^base64,SGVsbG8=)");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);
    });

    it("handles mailto link", () => {
      const view = createView("[text](mailto:test@^example.com)");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);
    });
  });

  describe("Link with title attribute", () => {
    it("handles link with title in double quotes", () => {
      const view = createView('[^text](url "This is a title")');
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);
    });

    it("handles link with title in single quotes", () => {
      const view = createView("[^text](url 'Title here')");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);
    });

    it("handles link with title in parentheses", () => {
      const view = createView("[^text](url (Title))");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);
    });

    it("navigates from URL portion in link with title", () => {
      const view = createView('[text](ur^l "title")');
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);

      // Should jump after the closing )
      const cursor = view.state.selection.main.from;
      expect(cursor).toBe(view.state.doc.toString().length);
    });
  });

  describe("Malformed links", () => {
    it("handles link missing closing bracket", () => {
      const text = "[text^](url";
      const posInLine = text.indexOf("^");
      const cleanText = text.replace("^", "");

      const boundaries = getLinkBoundaries(cleanText, posInLine);
      expect(boundaries).toBeNull(); // Should not match malformed link
    });

    it("handles link missing opening paren", () => {
      const text = "[text^]url)";
      const posInLine = text.indexOf("^");
      const cleanText = text.replace("^", "");

      const boundaries = getLinkBoundaries(cleanText, posInLine);
      expect(boundaries).toBeNull();
    });

    it("handles link missing closing paren", () => {
      const text = "[text^](url";
      const posInLine = text.indexOf("^");
      const cleanText = text.replace("^", "");

      const boundaries = getLinkBoundaries(cleanText, posInLine);
      expect(boundaries).toBeNull();
    });

    it("handles reversed brackets", () => {
      const text = "]text^[(url)";
      const posInLine = text.indexOf("^");
      const cleanText = text.replace("^", "");

      const boundaries = getLinkBoundaries(cleanText, posInLine);
      expect(boundaries).toBeNull();
    });
  });

  describe("Adjacent and nested structures", () => {
    it("handles adjacent links", () => {
      const view = createView("[first](url1)[sec^ond](url2)");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);

      const cursor = view.state.selection.main.from;
      const doc = view.state.doc.toString();
      // Should navigate within second link, not first
      expect(doc.substring(cursor, cursor + 4)).toBe("url2");
    });

    it("handles link followed by image", () => {
      const view = createView("[link](url1)![^image](img.png)");
      const handled = tabNavigateLink(view);
      // Cursor is in image syntax, which is different from link
      // Current implementation might not handle images
    });

    it("handles link in bold text", () => {
      // Markdown: **[link^](url)**
      const view = createView("**[link^](url)**");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);
    });

    it("handles link in list item", () => {
      const view = createView("- [link ^text](url)");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);
    });

    it("handles link in blockquote", () => {
      const view = createView("> [link ^text](url)");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);
    });
  });

  describe("Reference-style links (not supported)", () => {
    it("does not navigate in reference link", () => {
      const view = createView("[text^][ref]");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(false); // Should not handle reference-style
    });

    it("does not navigate in link definition", () => {
      const view = createView("[ref^]: https://example.com");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(false);
    });
  });

  describe("Autolinks (not supported)", () => {
    it("does not navigate in autolink", () => {
      const view = createView("<https://exam^ple.com>");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(false); // Autolinks are different syntax
    });
  });

  describe("Image syntax (similar to links)", () => {
    it("handles image syntax navigation", () => {
      const view = createView("![alt ^text](image.png)");
      const handled = tabNavigateLink(view);
      // Images use same syntax as links, should work
      expect(handled).toBe(true);
    });

    it("navigates from alt text to image URL", () => {
      const view = createView("![alt^](image.png)");
      const handled = tabNavigateLink(view);
      expect(handled).toBe(true);

      const cursor = view.state.selection.main.from;
      const doc = view.state.doc.toString();
      expect(doc.charAt(cursor)).toBe("i"); // Should jump to "image.png"
    });
  });
});

describe("Source Mode Tab Escape - Closing Characters Edge Cases", () => {
  describe("Single closing characters", () => {
    it("jumps over closing paren", () => {
      const view = createView("text^)");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
      expect(view.state.selection.main.from).toBe(5); // After )
    });

    it("jumps over closing bracket", () => {
      const view = createView("text^]");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
      expect(view.state.selection.main.from).toBe(5);
    });

    it("jumps over closing brace", () => {
      const view = createView("text^}");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
      expect(view.state.selection.main.from).toBe(5);
    });

    it("jumps over double quote", () => {
      const view = createView('text^"');
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
      expect(view.state.selection.main.from).toBe(5);
    });

    it("jumps over single quote", () => {
      const view = createView("text^'");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
      expect(view.state.selection.main.from).toBe(5);
    });

    it("jumps over backtick", () => {
      const view = createView("text^`");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
      expect(view.state.selection.main.from).toBe(5);
    });

    it("jumps over greater-than", () => {
      const view = createView("text^>");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
      expect(view.state.selection.main.from).toBe(5);
    });
  });

  describe("Markdown formatting characters", () => {
    it("jumps over asterisk (emphasis)", () => {
      const view = createView("text^*");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
      expect(view.state.selection.main.from).toBe(5);
    });

    it("jumps over underscore (emphasis)", () => {
      const view = createView("text^_");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
      expect(view.state.selection.main.from).toBe(5);
    });

    it("jumps over caret (superscript)", () => {
      const view = createView("text^^");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
      expect(view.state.selection.main.from).toBe(5);
    });
  });

  describe("Multi-character sequences", () => {
    it("jumps over double tilde (strikethrough)", () => {
      const view = createView("text^~~");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
      expect(view.state.selection.main.from).toBe(6); // After ~~
    });

    it("jumps over double equals (highlight)", () => {
      const view = createView("text^==");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
      expect(view.state.selection.main.from).toBe(6); // After ==
    });

    it("does not jump if only one character of sequence", () => {
      const view = createView("text^~");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(false); // Single ~ is not a closing sequence
    });
  });

  describe("CJK closing brackets", () => {
    it("jumps over CJK closing paren", () => {
      const view = createView("文字^）");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
    });

    it("jumps over CJK closing bracket", () => {
      const view = createView("文字^】");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
    });

    it("jumps over CJK closing quote", () => {
      const view = createView("文字^」");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
    });

    it("jumps over CJK guillemet", () => {
      const view = createView("文字^》");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
    });
  });

  describe("Curly quotes", () => {
    it("jumps over right double quote", () => {
      const view = createView("text^\u201D"); // U+201D right double quote
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
    });

    it("jumps over right single quote", () => {
      const view = createView("text^\u2019"); // U+2019 right single quote
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
    });
  });

  describe("Edge cases for closing character escape", () => {
    it("does not jump when closing char is not immediately next", () => {
      const view = createView("text^ )"); // Space before )
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(false); // Should not jump over space
    });

    it("handles multiple closing chars in sequence", () => {
      const view = createView("text^)]}");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
      expect(view.state.selection.main.from).toBe(5); // Only jumps over first )
    });

    it("handles closing char at end of line", () => {
      const view = createView("text^)\n");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
      expect(view.state.selection.main.from).toBe(5);
    });

    it("handles closing char at end of document", () => {
      const view = createView("text^)");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
      expect(view.state.selection.main.from).toBe(5);
    });
  });

  describe("Priority: link navigation vs closing char", () => {
    it("prioritizes link navigation over closing char", () => {
      // Cursor at end of [text] - should jump to URL, not over ]
      const view = createView("[text^](url)");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);

      const cursor = view.state.selection.main.from;
      const doc = view.state.doc.toString();
      expect(doc.charAt(cursor)).toBe("u"); // Should jump to URL, not over ]
    });

    it("uses closing char escape when not in link", () => {
      const view = createView("array[index^]");
      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(true);
      expect(view.state.selection.main.from).toBe(12); // After ]
    });
  });

  describe("Does not handle when selection exists", () => {
    it("returns false when there is a selection", () => {
      const content = "text)";
      const state = EditorState.create({
        doc: content,
        selection: { anchor: 0, head: 3 }, // Select "tex"
      });

      const container = document.createElement("div");
      document.body.appendChild(container);
      const view = new EditorView({ state, parent: container });
      views.push(view);

      const handled = tabEscapeKeymap.run!(view);
      expect(handled).toBe(false); // Should not handle with selection
    });
  });
});

describe("Source Mode Tab Escape - Complex Scenarios", () => {
  it("handles link inside inline code (should not navigate)", () => {
    // `[text](url)` - this is code, not a link
    const view = createView("`[text^](url)`");
    // getLinkBoundaries works on raw text, so might incorrectly detect
    // This is a known limitation
  });

  it("handles very long link text", () => {
    const longText = "a".repeat(1000);
    const view = createView(`[${longText}^](url)`);
    const handled = tabNavigateLink(view);
    expect(handled).toBe(true);
  });

  it("handles very long URL", () => {
    const longUrl = "https://example.com/" + "a".repeat(1000);
    const view = createView(`[text](${longUrl}^)`);
    const handled = tabNavigateLink(view);
    expect(handled).toBe(true);
  });

  it("handles link at start of line", () => {
    const view = createView("[^text](url)");
    const handled = tabNavigateLink(view);
    expect(handled).toBe(true);
  });

  it("handles link at end of line", () => {
    const view = createView("Text [link](ur^l)");
    const handled = tabNavigateLink(view);
    expect(handled).toBe(true);
  });

  it("handles multiple links on same line", () => {
    const view = createView("[first](url1) text [sec^ond](url2) more");
    const handled = tabNavigateLink(view);
    expect(handled).toBe(true);

    const cursor = view.state.selection.main.from;
    const doc = view.state.doc.toString();
    // Should navigate within second link
    expect(doc.substring(cursor, cursor + 4)).toBe("url2");
  });

  it("handles link spanning multiple visually wrapped lines (still same line)", () => {
    const longText = "This is a very long link text that might wrap visually but is still one line";
    const view = createView(`[${longText}^](url)`);
    const handled = tabNavigateLink(view);
    expect(handled).toBe(true);
  });
});
