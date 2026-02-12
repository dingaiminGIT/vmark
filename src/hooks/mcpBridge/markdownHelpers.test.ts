/**
 * Markdown Helpers Tests
 *
 * Tests for parseInlineMarkdown and parseBlockMarkdown helpers
 * that fix escape sequence handling issues.
 */

import { describe, it, expect } from "vitest";
import { parseInlineMarkdown, parseBlockMarkdown } from "./markdownHelpers";
import { schema } from "@tiptap/pm/schema-basic";

describe("markdownHelpers", () => {
  const testSchema = schema;

  describe("parseInlineMarkdown", () => {
    it("should extract inline content from simple text", () => {
      const nodes = parseInlineMarkdown(testSchema, "hello world");

      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0].type).toBe("text");
    });

    it("should handle escaped custom markers (\\==)", () => {
      const nodes = parseInlineMarkdown(testSchema, "\\==highlighted\\==");

      expect(nodes.length).toBeGreaterThan(0);
      const text = nodes.map(n => n.text || "").join("");
      // Should be literal ==, not formatting
      expect(text).toBe("==highlighted==");
    });

    it("should handle escaped ++ markers", () => {
      const nodes = parseInlineMarkdown(testSchema, "\\++inserted\\++");

      expect(nodes.length).toBeGreaterThan(0);
      const text = nodes.map(n => n.text || "").join("");
      expect(text).toBe("++inserted++");
    });

    it("should handle multiple escaped markers", () => {
      const nodes = parseInlineMarkdown(testSchema, "\\==mark\\== and \\++insert\\++");

      expect(nodes.length).toBeGreaterThan(0);
      const text = nodes.map(n => n.text || "").join("");
      expect(text).toContain("==mark==");
      expect(text).toContain("++insert++");
    });

    it("should return empty for block-level content", () => {
      const nodes = parseInlineMarkdown(testSchema, "# Heading");

      // Should return empty since heading is block-level
      expect(nodes).toEqual([]);
    });

    it("should extract inline content and ignore paragraph wrapper", () => {
      const nodes = parseInlineMarkdown(testSchema, "plain text");

      // Should extract text nodes, not paragraph node
      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0].type).toBe("text");
      // Should NOT be a paragraph
      expect(nodes[0].type).not.toBe("paragraph");
    });

    it("should throw error on multi-paragraph input to prevent data loss", () => {
      // This is a critical safety check - multi-paragraph content would lose
      // everything after the first paragraph if we silently extracted only first para
      expect(() => {
        parseInlineMarkdown(testSchema, "First paragraph\n\nSecond paragraph");
      }).toThrow(/Multi-paragraph input detected/);
    });

    it("should throw error with helpful message for multi-paragraph content", () => {
      try {
        parseInlineMarkdown(testSchema, "Para 1\n\nPara 2\n\nPara 3");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("3 paragraphs");
        expect((error as Error).message).toContain("parseBlockMarkdown");
      }
    });
  });

  describe("parseBlockMarkdown", () => {
    it("should return block-level nodes", () => {
      const nodes = parseBlockMarkdown(testSchema, "Simple paragraph");

      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0].type).toBe("paragraph");
    });

    it("should handle headings", () => {
      const nodes = parseBlockMarkdown(testSchema, "# Heading");

      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0].type).toBe("heading");
    });

    it("should handle escaped markers in block context", () => {
      const nodes = parseBlockMarkdown(testSchema, "Text with \\==literal\\== markers");

      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0].type).toBe("paragraph");

      // Extract text from paragraph content
      const content = nodes[0].content;
      expect(content).toBeDefined();
      if (content && content.length > 0) {
        const text = content.map((n: any) => n.text || "").join("");
        expect(text).toContain("==literal==");
      }
    });

    it("should preserve multiple blocks", () => {
      const nodes = parseBlockMarkdown(testSchema, "First paragraph\n\nSecond paragraph");

      expect(nodes.length).toBe(2);
      expect(nodes[0].type).toBe("paragraph");
      expect(nodes[1].type).toBe("paragraph");
    });

    it("should handle mixed block types", () => {
      const nodes = parseBlockMarkdown(testSchema, "# Heading\n\nParagraph");

      expect(nodes.length).toBe(2);
      expect(nodes[0].type).toBe("heading");
      expect(nodes[1].type).toBe("paragraph");
    });
  });

  describe("Context-aware parsing", () => {
    it("inline parser should not create paragraph nodes", () => {
      const inlineNodes = parseInlineMarkdown(testSchema, "text");
      const blockNodes = parseBlockMarkdown(testSchema, "text");

      // Inline should return text nodes only
      expect(inlineNodes.length).toBeGreaterThan(0);
      expect(inlineNodes[0].type).toBe("text");

      // Block should return paragraph node
      expect(blockNodes.length).toBeGreaterThan(0);
      expect(blockNodes[0].type).toBe("paragraph");
    });

    it("should handle escape sequences consistently", () => {
      const inlineNodes = parseInlineMarkdown(testSchema, "\\==test\\==");
      const blockNodes = parseBlockMarkdown(testSchema, "\\==test\\==");

      // Both should preserve literal == markers
      const inlineText = inlineNodes.map(n => n.text || "").join("");
      expect(inlineText).toBe("==test==");

      // Block should have it in paragraph content
      const blockContent = blockNodes[0].content;
      if (blockContent && blockContent.length > 0) {
        const blockText = blockContent.map((n: any) => n.text || "").join("");
        expect(blockText).toBe("==test==");
      }
    });
  });
});
