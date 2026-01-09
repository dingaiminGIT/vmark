/**
 * ProseMirror to MDAST conversion tests
 *
 * Tests proseMirrorToMdast function for converting ProseMirror nodes to MDAST nodes.
 * TDD: Write tests first, then implement.
 */

import { describe, it, expect } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { proseMirrorToMdast } from "./proseMirrorToMdast";
import { serializeMdastToMarkdown } from "./serializer";

// Minimal schema for testing basic node types
const testSchema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    heading: {
      attrs: { level: { default: 1 } },
      content: "inline*",
      group: "block",
    },
    codeBlock: {
      attrs: { language: { default: null } },
      content: "text*",
      marks: "",
      group: "block",
      code: true,
    },
    blockquote: { content: "block+", group: "block" },
    bulletList: { content: "listItem+", group: "block" },
    orderedList: {
      attrs: { start: { default: 1 } },
      content: "listItem+",
      group: "block",
    },
    listItem: {
      attrs: { checked: { default: null } },
      content: "block+",
    },
    horizontalRule: { group: "block" },
    hardBreak: { inline: true, group: "inline" },
    text: { group: "inline" },
    image: {
      attrs: { src: {}, alt: { default: null }, title: { default: null } },
      inline: true,
      group: "inline",
    },
    // Custom nodes
    math_inline: {
      content: "text*",
      marks: "",
      inline: true,
      group: "inline",
    },
    footnote_reference: {
      attrs: { label: { default: "1" } },
      inline: true,
      group: "inline",
      atom: true,
    },
    footnote_definition: {
      attrs: { label: { default: "1" } },
      content: "paragraph",
      group: "block",
    },
  },
  marks: {
    bold: {},
    italic: {},
    strike: {},
    code: {},
    link: { attrs: { href: {} } },
    subscript: {},
    superscript: {},
    highlight: {},
    underline: {},
  },
});

/**
 * Helper to create ProseMirror doc and convert to markdown string.
 */
function pmToMarkdown(children: ReturnType<typeof testSchema.node>[]): string {
  const doc = testSchema.node("doc", null, children);
  const mdast = proseMirrorToMdast(testSchema, doc);
  return serializeMdastToMarkdown(mdast);
}

describe("proseMirrorToMdast", () => {
  describe("basic blocks", () => {
    it("converts a paragraph", () => {
      const md = pmToMarkdown([
        testSchema.node("paragraph", null, [testSchema.text("Hello world")]),
      ]);

      expect(md.trim()).toBe("Hello world");
    });

    it("converts headings with correct level", () => {
      const md = pmToMarkdown([
        testSchema.node("heading", { level: 1 }, [testSchema.text("H1")]),
        testSchema.node("heading", { level: 2 }, [testSchema.text("H2")]),
        testSchema.node("heading", { level: 3 }, [testSchema.text("H3")]),
      ]);

      expect(md).toContain("# H1");
      expect(md).toContain("## H2");
      expect(md).toContain("### H3");
    });

    it("converts code blocks with language", () => {
      const md = pmToMarkdown([
        testSchema.node("codeBlock", { language: "javascript" }, [
          testSchema.text("const x = 1;"),
        ]),
      ]);

      expect(md).toContain("```javascript");
      expect(md).toContain("const x = 1;");
      expect(md).toContain("```");
    });

    it("converts blockquotes", () => {
      const md = pmToMarkdown([
        testSchema.node("blockquote", null, [
          testSchema.node("paragraph", null, [testSchema.text("Quote text")]),
        ]),
      ]);

      expect(md).toContain("> Quote text");
    });

    it("converts horizontal rules", () => {
      const md = pmToMarkdown([
        testSchema.node("paragraph", null, [testSchema.text("Before")]),
        testSchema.node("horizontalRule"),
        testSchema.node("paragraph", null, [testSchema.text("After")]),
      ]);

      expect(md).toContain("---");
    });
  });

  describe("lists", () => {
    it("converts bullet lists", () => {
      const md = pmToMarkdown([
        testSchema.node("bulletList", null, [
          testSchema.node("listItem", null, [
            testSchema.node("paragraph", null, [testSchema.text("Item 1")]),
          ]),
          testSchema.node("listItem", null, [
            testSchema.node("paragraph", null, [testSchema.text("Item 2")]),
          ]),
        ]),
      ]);

      expect(md).toContain("- Item 1");
      expect(md).toContain("- Item 2");
    });

    it("converts ordered lists", () => {
      const md = pmToMarkdown([
        testSchema.node("orderedList", { start: 1 }, [
          testSchema.node("listItem", null, [
            testSchema.node("paragraph", null, [testSchema.text("First")]),
          ]),
          testSchema.node("listItem", null, [
            testSchema.node("paragraph", null, [testSchema.text("Second")]),
          ]),
        ]),
      ]);

      expect(md).toContain("1. First");
      expect(md).toContain("2. Second");
    });

    it("converts task lists", () => {
      const md = pmToMarkdown([
        testSchema.node("bulletList", null, [
          testSchema.node("listItem", { checked: false }, [
            testSchema.node("paragraph", null, [testSchema.text("Todo")]),
          ]),
          testSchema.node("listItem", { checked: true }, [
            testSchema.node("paragraph", null, [testSchema.text("Done")]),
          ]),
        ]),
      ]);

      expect(md).toContain("[ ] Todo");
      expect(md).toContain("[x] Done");
    });
  });

  describe("inline marks", () => {
    it("converts bold text", () => {
      const boldMark = testSchema.mark("bold");
      const md = pmToMarkdown([
        testSchema.node("paragraph", null, [
          testSchema.text("bold", [boldMark]),
        ]),
      ]);

      expect(md).toContain("**bold**");
    });

    it("converts italic text", () => {
      const italicMark = testSchema.mark("italic");
      const md = pmToMarkdown([
        testSchema.node("paragraph", null, [
          testSchema.text("italic", [italicMark]),
        ]),
      ]);

      expect(md).toContain("*italic*");
    });

    it("converts strikethrough", () => {
      const strikeMark = testSchema.mark("strike");
      const md = pmToMarkdown([
        testSchema.node("paragraph", null, [
          testSchema.text("strike", [strikeMark]),
        ]),
      ]);

      expect(md).toContain("~~strike~~");
    });

    it("converts inline code", () => {
      const codeMark = testSchema.mark("code");
      const md = pmToMarkdown([
        testSchema.node("paragraph", null, [
          testSchema.text("code", [codeMark]),
        ]),
      ]);

      expect(md).toContain("`code`");
    });

    it("converts links", () => {
      const linkMark = testSchema.mark("link", { href: "https://example.com" });
      const md = pmToMarkdown([
        testSchema.node("paragraph", null, [
          testSchema.text("link", [linkMark]),
        ]),
      ]);

      expect(md).toContain("[link](https://example.com)");
    });
  });

  describe("images", () => {
    it("converts inline images", () => {
      const md = pmToMarkdown([
        testSchema.node("paragraph", null, [
          testSchema.node("image", {
            src: "image.png",
            alt: "alt text",
            title: null,
          }),
        ]),
      ]);

      expect(md).toContain("![alt text](image.png)");
    });
  });

  describe("math", () => {
    it("converts inline math", () => {
      const md = pmToMarkdown([
        testSchema.node("paragraph", null, [
          testSchema.node("math_inline", null, [testSchema.text("E=mc^2")]),
        ]),
      ]);

      expect(md).toContain("$E=mc^2$");
    });
  });

  describe("footnotes", () => {
    it("converts footnote references", () => {
      const md = pmToMarkdown([
        testSchema.node("paragraph", null, [
          testSchema.text("Some text"),
          testSchema.node("footnote_reference", { label: "1" }),
        ]),
      ]);

      expect(md).toContain("[^1]");
    });

    it("converts footnote definitions", () => {
      const md = pmToMarkdown([
        testSchema.node("footnote_definition", { label: "1" }, [
          testSchema.node("paragraph", null, [
            testSchema.text("This is the footnote"),
          ]),
        ]),
      ]);

      expect(md).toContain("[^1]:");
      expect(md).toContain("This is the footnote");
    });
  });

  describe("custom inline marks", () => {
    it("converts subscript", () => {
      const subscriptMark = testSchema.mark("subscript");
      const md = pmToMarkdown([
        testSchema.node("paragraph", null, [
          testSchema.text("H"),
          testSchema.text("2", [subscriptMark]),
          testSchema.text("O"),
        ]),
      ]);

      expect(md).toContain("~2~");
    });

    it("converts superscript", () => {
      const superscriptMark = testSchema.mark("superscript");
      const md = pmToMarkdown([
        testSchema.node("paragraph", null, [
          testSchema.text("x"),
          testSchema.text("2", [superscriptMark]),
        ]),
      ]);

      expect(md).toContain("^2^");
    });

    it("converts highlight", () => {
      const highlightMark = testSchema.mark("highlight");
      const md = pmToMarkdown([
        testSchema.node("paragraph", null, [
          testSchema.text("important", [highlightMark]),
        ]),
      ]);

      expect(md).toContain("==important==");
    });

    it("converts underline", () => {
      const underlineMark = testSchema.mark("underline");
      const md = pmToMarkdown([
        testSchema.node("paragraph", null, [
          testSchema.text("underlined", [underlineMark]),
        ]),
      ]);

      expect(md).toContain("++underlined++");
    });
  });
});
