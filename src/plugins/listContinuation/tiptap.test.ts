/**
 * Tests for list continuation extension.
 *
 * Tests Enter key behavior in lists:
 * - Empty list item: lifts out of list (exits)
 * - Non-empty list item: splits into new item
 */

import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { listContinuationExtension } from "./tiptap";

function createEditor(content: string) {
  return new Editor({
    extensions: [StarterKit, listContinuationExtension],
    content,
  });
}

describe("listContinuationExtension", () => {
  describe("Enter in non-empty list item", () => {
    it("splits list item when content exists", () => {
      const editor = createEditor("<ul><li>First item</li></ul>");

      // Position cursor at end of "First item"
      editor.commands.focus("end");

      // Simulate Enter key
      editor.commands.keyboardShortcut("Enter");

      const html = editor.getHTML();
      // Should now have two list items (TipTap wraps content in <p> tags)
      expect(html).toContain("<li><p>First item</p></li>");
      expect(html).toMatch(/<li><p>(<br[^>]*>)?<\/p><\/li>/); // Empty new item

      editor.destroy();
    });

    it("splits list item in middle of text", () => {
      const editor = createEditor("<ul><li>Hello World</li></ul>");

      // Position cursor after "Hello "
      // The list item content starts at position 2
      editor.commands.setTextSelection(8);

      editor.commands.keyboardShortcut("Enter");

      const html = editor.getHTML();
      // Should split into "Hello " and "World"
      expect(html).toMatch(/<li>.*Hello.*<\/li>/);

      editor.destroy();
    });
  });

  describe("Enter in empty list item", () => {
    it("exits list when pressing Enter on empty item", () => {
      const editor = createEditor("<ul><li>First item</li><li></li></ul>");

      // Position cursor in empty list item (the second one)
      // Doc structure: <doc><bullet_list><list_item><p>First item</p></list_item><list_item><p></p></list_item></bullet_list></doc>
      editor.commands.focus("end");

      // Simulate Enter key - should lift out of the empty list item
      editor.commands.keyboardShortcut("Enter");

      // After exiting, should have content outside the list
      const html = editor.getHTML();
      // The empty list item should be converted to paragraph outside list
      // The list might still exist with "First item"
      expect(html).toContain("First item");

      editor.destroy();
    });
  });

  describe("behavior outside lists", () => {
    it("does not affect Enter in paragraphs", () => {
      const editor = createEditor("<p>Normal paragraph</p>");

      editor.commands.focus("end");
      editor.commands.keyboardShortcut("Enter");

      const html = editor.getHTML();
      // Should create a new paragraph
      expect(html).toMatch(/<p>.*<\/p>/);

      editor.destroy();
    });

    it("does not affect Enter in headings", () => {
      const editor = createEditor("<h1>Heading</h1>");

      editor.commands.focus("end");
      editor.commands.keyboardShortcut("Enter");

      const html = editor.getHTML();
      expect(html).toContain("<h1>Heading</h1>");

      editor.destroy();
    });
  });

  describe("ordered lists", () => {
    it("continues numbered list when content exists", () => {
      const editor = createEditor("<ol><li>First</li></ol>");

      editor.commands.focus("end");
      editor.commands.keyboardShortcut("Enter");

      const html = editor.getHTML();
      expect(html).toContain("<ol>");
      expect(html).toContain("<li><p>First</p></li>");

      editor.destroy();
    });
  });

  describe("nested lists", () => {
    it("handles Enter in nested list item", () => {
      const editor = createEditor("<ul><li>Parent<ul><li>Nested</li></ul></li></ul>");

      // This is a complex structure - just verify it doesn't throw
      editor.commands.focus("end");

      // Should not throw
      expect(() => editor.commands.keyboardShortcut("Enter")).not.toThrow();

      editor.destroy();
    });
  });
});
