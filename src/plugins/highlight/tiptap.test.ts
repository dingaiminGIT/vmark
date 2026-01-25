/**
 * Tests for highlight mark extension.
 */

import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { highlightExtension } from "./tiptap";

function createEditor(content: string) {
  return new Editor({
    extensions: [StarterKit, highlightExtension],
    content,
  });
}

describe("highlightExtension", () => {
  describe("parseHTML", () => {
    it("parses mark tags as highlight", () => {
      const editor = createEditor("<p>Hello <mark>world</mark></p>");

      const html = editor.getHTML();
      expect(html).toContain("mark");
      expect(html).toContain("world");

      editor.destroy();
    });

    it("preserves highlight class in output", () => {
      const editor = createEditor("<p>Hello <mark>world</mark></p>");

      const html = editor.getHTML();
      expect(html).toContain('class="md-highlight"');

      editor.destroy();
    });
  });

  describe("renderHTML", () => {
    it("renders highlight as mark tag with md-highlight class", () => {
      const editor = createEditor("<p>Hello world</p>");

      // Select "world" and apply highlight
      editor.commands.setTextSelection({ from: 8, to: 13 });
      editor.commands.setMark("highlight");

      const html = editor.getHTML();
      expect(html).toContain("<mark");
      expect(html).toContain('class="md-highlight"');

      editor.destroy();
    });
  });

  describe("toggle behavior", () => {
    it("can toggle highlight on and off", () => {
      const editor = createEditor("<p>Hello world</p>");

      // Select and highlight
      editor.commands.setTextSelection({ from: 8, to: 13 });
      editor.commands.setMark("highlight");
      expect(editor.getHTML()).toContain("<mark");

      // Toggle off - unset the mark
      editor.commands.setTextSelection({ from: 8, to: 13 });
      editor.commands.unsetMark("highlight");
      expect(editor.getHTML()).not.toContain("<mark");

      editor.destroy();
    });
  });

  describe("integration", () => {
    it("preserves other marks alongside highlight", () => {
      const editor = createEditor("<p>Hello <strong>world</strong></p>");

      // Select "world" (which is already bold) and add highlight
      editor.commands.setTextSelection({ from: 8, to: 13 });
      editor.commands.setMark("highlight");

      const html = editor.getHTML();
      expect(html).toContain("<mark");
      expect(html).toContain("<strong>");

      editor.destroy();
    });
  });
});
