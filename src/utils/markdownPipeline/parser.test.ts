/**
 * Parser tests for remark-based markdown pipeline
 *
 * Tests parseMarkdownToMdast function for CommonMark + GFM support.
 * TDD: Write tests first, then implement.
 */

import { describe, it, expect } from "vitest";
import { parseMarkdownToMdast } from "./parser";
import type { Paragraph, Text, Heading, Code } from "mdast";

describe("parseMarkdownToMdast", () => {
  describe("CommonMark basics", () => {
    it("parses a simple paragraph", () => {
      const result = parseMarkdownToMdast("Hello world");
      expect(result.type).toBe("root");
      expect(result.children).toHaveLength(1);

      const para = result.children[0] as Paragraph;
      expect(para.type).toBe("paragraph");

      const text = para.children[0] as Text;
      expect(text.type).toBe("text");
      expect(text.value).toBe("Hello world");
    });

    it("parses headings", () => {
      const result = parseMarkdownToMdast("# Heading 1\n\n## Heading 2");
      expect(result.children).toHaveLength(2);

      const h1 = result.children[0] as Heading;
      expect(h1.type).toBe("heading");
      expect(h1.depth).toBe(1);

      const h2 = result.children[1] as Heading;
      expect(h2.type).toBe("heading");
      expect(h2.depth).toBe(2);
    });

    it("parses code fences", () => {
      const result = parseMarkdownToMdast("```js\nconst x = 1;\n```");
      expect(result.children).toHaveLength(1);

      const code = result.children[0] as Code;
      expect(code.type).toBe("code");
      expect(code.lang).toBe("js");
      expect(code.value).toBe("const x = 1;");
    });

    it("parses blockquotes", () => {
      const result = parseMarkdownToMdast("> Quote text");
      expect(result.children).toHaveLength(1);
      expect(result.children[0].type).toBe("blockquote");
    });

    it("parses thematic breaks", () => {
      const result = parseMarkdownToMdast("---");
      expect(result.children).toHaveLength(1);
      expect(result.children[0].type).toBe("thematicBreak");
    });
  });

  describe("GFM extensions", () => {
    it("parses strikethrough", () => {
      const result = parseMarkdownToMdast("~~deleted~~");
      const para = result.children[0] as Paragraph;
      expect(para.children[0].type).toBe("delete");
    });

    it("parses tables", () => {
      const md = `| A | B |
| --- | --- |
| 1 | 2 |`;
      const result = parseMarkdownToMdast(md);
      expect(result.children[0].type).toBe("table");
    });

    it("parses task lists", () => {
      const md = `- [ ] unchecked
- [x] checked`;
      const result = parseMarkdownToMdast(md);
      expect(result.children[0].type).toBe("list");
    });

    it("parses autolinks", () => {
      const result = parseMarkdownToMdast("Visit https://example.com");
      const para = result.children[0] as Paragraph;
      // GFM autolinks become link nodes
      const hasLink = para.children.some((c) => c.type === "link");
      expect(hasLink).toBe(true);
    });
  });

  describe("frontmatter", () => {
    it("parses YAML frontmatter", () => {
      const md = `---
title: Test
---

Content`;
      const result = parseMarkdownToMdast(md);
      // Frontmatter should be a yaml node
      expect(result.children[0].type).toBe("yaml");
    });
  });

  describe("math (remark-math)", () => {
    it("parses inline math", () => {
      const result = parseMarkdownToMdast("Equation: $E = mc^2$");
      const para = result.children[0] as Paragraph;
      const hasMath = para.children.some((c) => c.type === "inlineMath");
      expect(hasMath).toBe(true);
    });

    it("parses block math", () => {
      const result = parseMarkdownToMdast("$$\nx^2 + y^2 = z^2\n$$");
      const hasMath = result.children.some((c) => c.type === "math");
      expect(hasMath).toBe(true);
    });
  });
});
