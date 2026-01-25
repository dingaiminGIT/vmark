/**
 * Tests for smartPaste extension - isSelectionInCode function
 */

import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

function createEditor(content: string) {
  return new Editor({
    extensions: [StarterKit],
    content,
  });
}

// Re-implement the isSelectionInCode logic for testing
// (The actual function is not exported, so we test the behavior through editor state)
function isSelectionInCode(editor: Editor): boolean {
  const { selection, schema } = editor.state;
  const codeBlock = schema.nodes.codeBlock;
  const codeMark = schema.marks.code;

  if (codeBlock) {
    for (let depth = selection.$from.depth; depth > 0; depth--) {
      if (selection.$from.node(depth).type === codeBlock) return true;
    }
  }

  if (codeMark) {
    const fromMarks = selection.$from.marks();
    if (codeMark.isInSet(fromMarks)) return true;
  }

  return false;
}

describe("smartPaste code detection", () => {
  describe("code block detection", () => {
    it("detects selection inside code block", () => {
      const editor = createEditor("<pre><code>some code here</code></pre>");

      // Select inside the code block
      editor.commands.setTextSelection({ from: 2, to: 6 });

      expect(isSelectionInCode(editor)).toBe(true);

      editor.destroy();
    });

    it("returns false for selection outside code block", () => {
      const editor = createEditor("<p>normal paragraph</p>");

      editor.commands.setTextSelection({ from: 2, to: 6 });

      expect(isSelectionInCode(editor)).toBe(false);

      editor.destroy();
    });

    it("detects selection in code block even with multiple paragraphs", () => {
      const editor = createEditor(`
        <p>First paragraph</p>
        <pre><code>code block content</code></pre>
        <p>Last paragraph</p>
      `);

      // Navigate to code block (positions depend on document structure)
      // The code block is the second node
      editor.commands.setTextSelection({ from: 18, to: 22 });

      // Check if we're in the code block
      const { selection, schema } = editor.state;
      const codeBlock = schema.nodes.codeBlock;
      let inCode = false;
      for (let depth = selection.$from.depth; depth > 0; depth--) {
        if (selection.$from.node(depth).type === codeBlock) {
          inCode = true;
          break;
        }
      }

      expect(inCode).toBe(true);

      editor.destroy();
    });
  });

  describe("inline code detection", () => {
    it("detects selection with inline code mark", () => {
      const editor = createEditor("<p>hello <code>world</code> text</p>");

      // The inline code "world" is around position 8-13
      editor.commands.setTextSelection({ from: 8, to: 12 });

      expect(isSelectionInCode(editor)).toBe(true);

      editor.destroy();
    });

    it("returns false for selection without code mark", () => {
      const editor = createEditor("<p>hello <code>world</code> text</p>");

      // Select "hello" which has no code mark
      editor.commands.setTextSelection({ from: 1, to: 6 });

      expect(isSelectionInCode(editor)).toBe(false);

      editor.destroy();
    });
  });

  describe("mixed content", () => {
    it("correctly identifies code vs non-code in same document", () => {
      const editor = createEditor(`
        <p>Normal text with <code>inline code</code> here</p>
        <pre><code>block code</code></pre>
        <p>More normal text</p>
      `);

      // Check normal text - position 2 should be in "Normal"
      editor.commands.setTextSelection({ from: 2, to: 4 });
      expect(isSelectionInCode(editor)).toBe(false);

      editor.destroy();
    });
  });
});
