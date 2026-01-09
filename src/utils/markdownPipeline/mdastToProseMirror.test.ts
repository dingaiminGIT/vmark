/**
 * MDAST to ProseMirror conversion tests
 *
 * Tests mdastToProseMirror function for converting MDAST nodes to ProseMirror nodes.
 * TDD: Write tests first, then implement.
 */

import { describe, it, expect } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { parseMarkdownToMdast } from "./parser";
import { mdastToProseMirror } from "./mdastToProseMirror";

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
  },
  marks: {
    bold: {},
    italic: {},
    strike: {},
    code: {},
    link: { attrs: { href: {} } },
  },
});

describe("mdastToProseMirror", () => {
  describe("basic blocks", () => {
    it("converts a paragraph", () => {
      const mdast = parseMarkdownToMdast("Hello world");
      const doc = mdastToProseMirror(testSchema, mdast);

      expect(doc.type.name).toBe("doc");
      expect(doc.childCount).toBe(1);
      expect(doc.firstChild?.type.name).toBe("paragraph");
      expect(doc.firstChild?.textContent).toBe("Hello world");
    });

    it("converts headings with correct level", () => {
      const mdast = parseMarkdownToMdast("# H1\n\n## H2\n\n### H3");
      const doc = mdastToProseMirror(testSchema, mdast);

      expect(doc.childCount).toBe(3);
      expect(doc.child(0).type.name).toBe("heading");
      expect(doc.child(0).attrs.level).toBe(1);
      expect(doc.child(1).attrs.level).toBe(2);
      expect(doc.child(2).attrs.level).toBe(3);
    });

    it("converts code blocks with language", () => {
      const mdast = parseMarkdownToMdast("```javascript\nconst x = 1;\n```");
      const doc = mdastToProseMirror(testSchema, mdast);

      expect(doc.firstChild?.type.name).toBe("codeBlock");
      expect(doc.firstChild?.attrs.language).toBe("javascript");
      expect(doc.firstChild?.textContent).toBe("const x = 1;");
    });

    it("converts blockquotes", () => {
      const mdast = parseMarkdownToMdast("> Quote text");
      const doc = mdastToProseMirror(testSchema, mdast);

      expect(doc.firstChild?.type.name).toBe("blockquote");
    });

    it("converts horizontal rules", () => {
      const mdast = parseMarkdownToMdast("---");
      const doc = mdastToProseMirror(testSchema, mdast);

      expect(doc.firstChild?.type.name).toBe("horizontalRule");
    });
  });

  describe("lists", () => {
    it("converts bullet lists", () => {
      const mdast = parseMarkdownToMdast("- Item 1\n- Item 2");
      const doc = mdastToProseMirror(testSchema, mdast);

      expect(doc.firstChild?.type.name).toBe("bulletList");
      expect(doc.firstChild?.childCount).toBe(2);
    });

    it("converts ordered lists", () => {
      const mdast = parseMarkdownToMdast("1. First\n2. Second");
      const doc = mdastToProseMirror(testSchema, mdast);

      expect(doc.firstChild?.type.name).toBe("orderedList");
      expect(doc.firstChild?.childCount).toBe(2);
    });

    it("converts task lists", () => {
      const mdast = parseMarkdownToMdast("- [ ] Todo\n- [x] Done");
      const doc = mdastToProseMirror(testSchema, mdast);

      const list = doc.firstChild;
      expect(list?.type.name).toBe("bulletList");
      expect(list?.child(0).attrs.checked).toBe(false);
      expect(list?.child(1).attrs.checked).toBe(true);
    });
  });

  describe("inline marks", () => {
    it("converts bold text", () => {
      const mdast = parseMarkdownToMdast("**bold**");
      const doc = mdastToProseMirror(testSchema, mdast);

      const para = doc.firstChild;
      const textNode = para?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === "bold")).toBe(true);
    });

    it("converts italic text", () => {
      const mdast = parseMarkdownToMdast("*italic*");
      const doc = mdastToProseMirror(testSchema, mdast);

      const para = doc.firstChild;
      const textNode = para?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === "italic")).toBe(true);
    });

    it("converts strikethrough", () => {
      const mdast = parseMarkdownToMdast("~~strike~~");
      const doc = mdastToProseMirror(testSchema, mdast);

      const para = doc.firstChild;
      const textNode = para?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === "strike")).toBe(true);
    });

    it("converts inline code", () => {
      const mdast = parseMarkdownToMdast("`code`");
      const doc = mdastToProseMirror(testSchema, mdast);

      const para = doc.firstChild;
      const textNode = para?.firstChild;
      expect(textNode?.marks.some((m) => m.type.name === "code")).toBe(true);
    });

    it("converts links", () => {
      const mdast = parseMarkdownToMdast("[link](https://example.com)");
      const doc = mdastToProseMirror(testSchema, mdast);

      const para = doc.firstChild;
      const textNode = para?.firstChild;
      const linkMark = textNode?.marks.find((m) => m.type.name === "link");
      expect(linkMark).toBeDefined();
      expect(linkMark?.attrs.href).toBe("https://example.com");
    });
  });

  describe("images", () => {
    it("converts inline images", () => {
      const mdast = parseMarkdownToMdast("![alt text](image.png)");
      const doc = mdastToProseMirror(testSchema, mdast);

      const para = doc.firstChild;
      const img = para?.firstChild;
      expect(img?.type.name).toBe("image");
      expect(img?.attrs.src).toBe("image.png");
      expect(img?.attrs.alt).toBe("alt text");
    });
  });
});
