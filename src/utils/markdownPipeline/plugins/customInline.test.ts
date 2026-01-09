/**
 * Custom inline syntax plugin tests
 *
 * Tests for ~subscript~, ^superscript^, ==highlight==, ++underline++ parsing.
 * TDD: Write tests first, then implement.
 */

import { describe, it, expect } from "vitest";
import { parseMarkdownToMdast } from "../parser";
import { serializeMdastToMarkdown } from "../serializer";

describe("customInline remark plugin", () => {
  describe("subscript ~text~", () => {
    it("parses subscript syntax", () => {
      const mdast = parseMarkdownToMdast("H~2~O is water");

      const para = mdast.children[0];
      expect(para?.type).toBe("paragraph");

      // Check that subscript node exists
      const children = (para as { children?: unknown[] })?.children ?? [];
      const subNode = children.find(
        (c) => (c as { type?: string }).type === "subscript"
      );
      expect(subNode).toBeDefined();
    });

    it("serializes subscript back to ~text~", () => {
      const mdast = parseMarkdownToMdast("H~2~O");
      const md = serializeMdastToMarkdown(mdast);

      expect(md.trim()).toBe("H~2~O");
    });

    it("ignores ~~ strikethrough", () => {
      // ~~ is strikethrough, not double subscript
      const mdast = parseMarkdownToMdast("~~strikethrough~~");

      const para = mdast.children[0];
      const children = (para as { children?: unknown[] })?.children ?? [];
      const subNode = children.find(
        (c) => (c as { type?: string }).type === "subscript"
      );
      expect(subNode).toBeUndefined();
    });
  });

  describe("superscript ^text^", () => {
    it("parses superscript syntax", () => {
      const mdast = parseMarkdownToMdast("E=mc^2^");

      const para = mdast.children[0];
      expect(para?.type).toBe("paragraph");

      const children = (para as { children?: unknown[] })?.children ?? [];
      const supNode = children.find(
        (c) => (c as { type?: string }).type === "superscript"
      );
      expect(supNode).toBeDefined();
    });

    it("serializes superscript back to ^text^", () => {
      const mdast = parseMarkdownToMdast("x^2^");
      const md = serializeMdastToMarkdown(mdast);

      expect(md.trim()).toBe("x^2^");
    });
  });

  describe("highlight ==text==", () => {
    it("parses highlight syntax", () => {
      const mdast = parseMarkdownToMdast("This is ==important== text");

      const para = mdast.children[0];
      expect(para?.type).toBe("paragraph");

      const children = (para as { children?: unknown[] })?.children ?? [];
      const highlightNode = children.find(
        (c) => (c as { type?: string }).type === "highlight"
      );
      expect(highlightNode).toBeDefined();
    });

    it("serializes highlight back to ==text==", () => {
      const mdast = parseMarkdownToMdast("==important==");
      const md = serializeMdastToMarkdown(mdast);

      expect(md.trim()).toBe("==important==");
    });
  });

  describe("underline ++text++", () => {
    it("parses underline syntax", () => {
      const mdast = parseMarkdownToMdast("This is ++underlined++ text");

      const para = mdast.children[0];
      expect(para?.type).toBe("paragraph");

      const children = (para as { children?: unknown[] })?.children ?? [];
      const underlineNode = children.find(
        (c) => (c as { type?: string }).type === "underline"
      );
      expect(underlineNode).toBeDefined();
    });

    it("serializes underline back to ++text++", () => {
      const mdast = parseMarkdownToMdast("++underlined++");
      const md = serializeMdastToMarkdown(mdast);

      expect(md.trim()).toBe("++underlined++");
    });
  });

  describe("nested marks", () => {
    it("handles nested subscript in bold", () => {
      const mdast = parseMarkdownToMdast("**H~2~O**");
      const md = serializeMdastToMarkdown(mdast);

      // Should preserve both marks
      expect(md).toContain("**");
      expect(md).toContain("~");
    });

    it("handles subscript alone", () => {
      const mdast = parseMarkdownToMdast("H~2~O");
      const md = serializeMdastToMarkdown(mdast);
      expect(md.trim()).toBe("H~2~O");
    });

    it("handles subscript with trailing text", () => {
      const mdast = parseMarkdownToMdast("H~2~O and water");
      const md = serializeMdastToMarkdown(mdast);
      expect(md.trim()).toBe("H~2~O and water");
    });

    it("handles superscript then subscript", () => {
      const mdast = parseMarkdownToMdast("x^2^ and H~2~O");
      const md = serializeMdastToMarkdown(mdast);
      expect(md.trim()).toBe("x^2^ and H~2~O");
    });

    it("handles subscript then superscript", () => {
      const mdast = parseMarkdownToMdast("H~2~O and x^2^");
      const md = serializeMdastToMarkdown(mdast);
      expect(md.trim()).toBe("H~2~O and x^2^");
    });

    it("handles multiple marks in one paragraph", () => {
      const mdast = parseMarkdownToMdast("H~2~O and x^2^ and ==highlight==");
      const md = serializeMdastToMarkdown(mdast);

      expect(md.trim()).toBe("H~2~O and x^2^ and ==highlight==");
    });
  });
});
