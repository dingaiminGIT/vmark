/**
 * Serializer tests for remark-based markdown pipeline
 *
 * Tests serializeMdastToMarkdown function.
 * TDD: Write tests first, then implement.
 */

import { describe, it, expect } from "vitest";
import { parseMarkdownToMdast } from "./parser";
import { serializeMdastToMarkdown } from "./serializer";

describe("serializeMdastToMarkdown", () => {
  describe("round-trip basics", () => {
    it("round-trips a simple paragraph", () => {
      const input = "Hello world";
      const mdast = parseMarkdownToMdast(input);
      const output = serializeMdastToMarkdown(mdast);
      expect(output.trim()).toBe(input);
    });

    it("round-trips headings", () => {
      const input = "# Heading 1";
      const mdast = parseMarkdownToMdast(input);
      const output = serializeMdastToMarkdown(mdast);
      expect(output.trim()).toBe(input);
    });

    it("round-trips code fences", () => {
      const input = "```js\nconst x = 1;\n```";
      const mdast = parseMarkdownToMdast(input);
      const output = serializeMdastToMarkdown(mdast);
      expect(output.trim()).toBe(input);
    });

    it("round-trips blockquotes", () => {
      const input = "> Quote text";
      const mdast = parseMarkdownToMdast(input);
      const output = serializeMdastToMarkdown(mdast);
      expect(output.trim()).toBe(input);
    });
  });

  describe("GFM round-trip", () => {
    it("round-trips strikethrough", () => {
      const input = "~~deleted~~";
      const mdast = parseMarkdownToMdast(input);
      const output = serializeMdastToMarkdown(mdast);
      expect(output.trim()).toBe(input);
    });

    it("round-trips tables", () => {
      const input = `| A | B |
| - | - |
| 1 | 2 |`;
      const mdast = parseMarkdownToMdast(input);
      const output = serializeMdastToMarkdown(mdast);
      // Table output may have slight formatting differences
      expect(output).toContain("| A | B |");
      expect(output).toContain("| 1 | 2 |");
    });

    it("round-trips task lists", () => {
      const input = `- [ ] unchecked
- [x] checked`;
      const mdast = parseMarkdownToMdast(input);
      const output = serializeMdastToMarkdown(mdast);
      expect(output).toContain("[ ]");
      expect(output).toContain("[x]");
    });
  });

  describe("frontmatter round-trip", () => {
    it("round-trips YAML frontmatter", () => {
      const input = `---
title: Test
---

Content`;
      const mdast = parseMarkdownToMdast(input);
      const output = serializeMdastToMarkdown(mdast);
      expect(output).toContain("---");
      expect(output).toContain("title: Test");
    });
  });

  describe("math round-trip", () => {
    it("round-trips inline math", () => {
      const input = "Equation: $E = mc^2$";
      const mdast = parseMarkdownToMdast(input);
      const output = serializeMdastToMarkdown(mdast);
      expect(output).toContain("$E = mc^2$");
    });

    it("round-trips block math", () => {
      const input = `$$
x^2 + y^2 = z^2
$$`;
      const mdast = parseMarkdownToMdast(input);
      const output = serializeMdastToMarkdown(mdast);
      expect(output).toContain("$$");
      expect(output).toContain("x^2 + y^2 = z^2");
    });
  });

  describe("wiki link round-trip", () => {
    it("round-trips wiki links", () => {
      const input = "See [[Page|Alias]]";
      const mdast = parseMarkdownToMdast(input);
      const output = serializeMdastToMarkdown(mdast);
      expect(output).toContain("[[Page|Alias]]");
    });
  });

  describe("details round-trip", () => {
    it("round-trips details blocks", () => {
      const input = "<details>\\n<summary>Info</summary>\\n\\nBody\\n</details>";
      const mdast = parseMarkdownToMdast(input);
      const output = serializeMdastToMarkdown(mdast);
      expect(output).toContain("<details");
      expect(output).toContain("<summary>Info</summary>");
      expect(output).toContain("Body");
    });
  });
});
