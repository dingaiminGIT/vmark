/**
 * Export utilities tests
 *
 * Tests for HTML export ensuring structure preservation and consistency.
 * Covers: tables, footnotes, math, alerts, details, wiki links, mermaid.
 */

import { describe, it, expect } from "vitest";
import { markdownToHtml, generateHtmlDocument, escapeHtml } from "./exportUtils";

describe("markdownToHtml", () => {
  describe("basic elements", () => {
    it("renders paragraphs", () => {
      const html = markdownToHtml("Hello world");
      expect(html).toContain("<p>");
      expect(html).toContain("Hello world");
    });

    it("renders headings", () => {
      const html = markdownToHtml("# Title\n\n## Subtitle");
      expect(html).toContain("<h1>");
      expect(html).toContain("Title");
      expect(html).toContain("<h2>");
      expect(html).toContain("Subtitle");
    });

    it("renders code blocks with language class", () => {
      const html = markdownToHtml("```javascript\nconst x = 1;\n```");
      expect(html).toContain("<pre>");
      expect(html).toContain("<code");
      expect(html).toContain("language-javascript");
      expect(html).toContain("const x = 1;");
    });

    it("renders inline code", () => {
      const html = markdownToHtml("Use `const` for constants");
      expect(html).toContain("<code>");
      expect(html).toContain("const");
    });

    it("renders blockquotes", () => {
      const html = markdownToHtml("> This is a quote");
      expect(html).toContain("<blockquote>");
      expect(html).toContain("This is a quote");
    });

    it("renders links", () => {
      const html = markdownToHtml("[Example](https://example.com)");
      expect(html).toContain("<a");
      expect(html).toContain('href="https://example.com"');
      expect(html).toContain("Example");
    });

    it("renders images", () => {
      const html = markdownToHtml("![Alt text](image.png)");
      expect(html).toContain("<img");
      expect(html).toContain('src="image.png"');
      expect(html).toContain('alt="Alt text"');
    });

    it("renders horizontal rules", () => {
      const html = markdownToHtml("Above\n\n---\n\nBelow");
      expect(html).toContain("<hr");
    });
  });

  describe("lists", () => {
    it("renders unordered lists", () => {
      const html = markdownToHtml("- Item 1\n- Item 2\n- Item 3");
      expect(html).toContain("<ul>");
      expect(html).toContain("<li>");
      expect(html).toContain("Item 1");
      expect(html).toContain("Item 2");
      expect(html).toContain("Item 3");
    });

    it("renders ordered lists", () => {
      const html = markdownToHtml("1. First\n2. Second\n3. Third");
      expect(html).toContain("<ol>");
      expect(html).toContain("<li>");
      expect(html).toContain("First");
    });

    it("renders nested lists", () => {
      const html = markdownToHtml("- Parent\n  - Child\n    - Grandchild");
      expect(html).toContain("<ul>");
      expect(html).toContain("Parent");
      expect(html).toContain("Child");
      expect(html).toContain("Grandchild");
    });

    it("renders task lists", () => {
      const html = markdownToHtml("- [ ] Todo\n- [x] Done");
      expect(html).toContain("Todo");
      expect(html).toContain("Done");
      // Task list items should have checkbox input
      expect(html).toContain('type="checkbox"');
    });
  });

  describe("tables", () => {
    it("renders basic tables", () => {
      const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
      const html = markdownToHtml(md);
      expect(html).toContain("<table>");
      expect(html).toContain("<thead>");
      expect(html).toContain("<tbody>");
      expect(html).toContain("<tr>");
      expect(html).toContain("<th>");
      expect(html).toContain("<td>");
      expect(html).toContain(">A<");
      expect(html).toContain(">B<");
      expect(html).toContain(">1<");
      expect(html).toContain(">2<");
    });

    it("renders tables with multiple rows", () => {
      const md = "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |";
      const html = markdownToHtml(md);
      expect(html).toContain("Alice");
      expect(html).toContain("Bob");
      expect(html).toContain("30");
      expect(html).toContain("25");
    });

    it("preserves table cell content with formatting", () => {
      const md = "| Header |\n| --- |\n| **bold** and *italic* |";
      const html = markdownToHtml(md);
      expect(html).toContain("<strong>bold</strong>");
      expect(html).toContain("<em>italic</em>");
    });

    it("renders tables with alignment", () => {
      const md = "| Left | Center | Right |\n| :--- | :---: | ---: |\n| L | C | R |";
      const html = markdownToHtml(md);
      expect(html).toContain("<table>");
      // Content should be preserved regardless of alignment
      expect(html).toContain("Left");
      expect(html).toContain("Center");
      expect(html).toContain("Right");
    });
  });

  describe("footnotes", () => {
    it("renders footnote references", () => {
      const md = "Text with footnote[^1]\n\n[^1]: This is the footnote";
      const html = markdownToHtml(md);
      // Footnote reference should create a link
      expect(html).toContain("footnote");
      // Footnote definition should be rendered
      expect(html).toContain("This is the footnote");
    });

    it("renders multiple footnotes", () => {
      const md = "First[^a] and second[^b]\n\n[^a]: Note A\n\n[^b]: Note B";
      const html = markdownToHtml(md);
      expect(html).toContain("Note A");
      expect(html).toContain("Note B");
    });

    it("renders footnotes with complex content", () => {
      const md = "Reference[^1]\n\n[^1]: Footnote with **bold** and `code`";
      const html = markdownToHtml(md);
      expect(html).toContain("<strong>bold</strong>");
      expect(html).toContain("<code>code</code>");
    });
  });

  describe("math", () => {
    it("renders inline math", () => {
      const html = markdownToHtml("Formula: $E=mc^2$");
      expect(html).toContain("math-inline");
      expect(html).toContain("E=mc^2");
    });

    it("renders block math", () => {
      const html = markdownToHtml("$$\nx^2 + y^2 = z^2\n$$");
      expect(html).toContain("math-block");
      expect(html).toContain("x^2 + y^2 = z^2");
    });

    it("renders complex math expressions", () => {
      const html = markdownToHtml("$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$");
      expect(html).toContain("math-inline");
      expect(html).toContain("\\int");
      expect(html).toContain("\\frac");
    });

    it("preserves math delimiters in output", () => {
      const inlineMd = "Inline: $a + b$";
      const blockMd = "$$\nc = d\n$$";
      const inlineHtml = markdownToHtml(inlineMd);
      const blockHtml = markdownToHtml(blockMd);
      // Math content should be present (even if not rendered as LaTeX)
      expect(inlineHtml).toContain("a + b");
      expect(blockHtml).toContain("c = d");
    });
  });

  describe("alerts", () => {
    it("renders NOTE alert", () => {
      const html = markdownToHtml("> [!NOTE]\n> This is a note");
      expect(html).toContain("markdown-alert");
      expect(html).toContain("markdown-alert-note");
      expect(html).toContain("This is a note");
    });

    it("renders TIP alert", () => {
      const html = markdownToHtml("> [!TIP]\n> This is a tip");
      expect(html).toContain("markdown-alert-tip");
    });

    it("renders IMPORTANT alert", () => {
      const html = markdownToHtml("> [!IMPORTANT]\n> This is important");
      expect(html).toContain("markdown-alert-important");
    });

    it("renders WARNING alert", () => {
      const html = markdownToHtml("> [!WARNING]\n> This is a warning");
      expect(html).toContain("markdown-alert-warning");
    });

    it("renders CAUTION alert", () => {
      const html = markdownToHtml("> [!CAUTION]\n> This is caution");
      expect(html).toContain("markdown-alert-caution");
    });

    it("renders alert with multiple paragraphs", () => {
      const html = markdownToHtml("> [!NOTE]\n> First paragraph\n>\n> Second paragraph");
      expect(html).toContain("First paragraph");
      expect(html).toContain("Second paragraph");
    });
  });

  describe("details blocks", () => {
    it("renders details blocks", () => {
      const html = markdownToHtml("<details><summary>Click</summary>\n\nHello\n</details>");
      expect(html).toContain("<details");
      expect(html).toContain("<summary>Click</summary>");
      expect(html).toContain("Hello");
    });

    it("renders details with open attribute", () => {
      const html = markdownToHtml("<details open><summary>Open</summary>\n\nContent\n</details>");
      expect(html).toContain("<details");
      expect(html).toContain("open");
    });

    it("renders details with formatted content", () => {
      const html = markdownToHtml("<details><summary>Info</summary>\n\n**Bold** and *italic*\n</details>");
      expect(html).toContain("<strong>Bold</strong>");
      expect(html).toContain("<em>italic</em>");
    });
  });

  describe("wiki links", () => {
    it("renders wiki links with alias", () => {
      const html = markdownToHtml("[[Page|Alias]]");
      expect(html).toContain("wiki-link");
      expect(html).toContain(">Alias<");
    });

    it("renders wiki links without alias", () => {
      const html = markdownToHtml("[[Page Name]]");
      expect(html).toContain("wiki-link");
      expect(html).toContain(">Page Name<");
    });

    it("renders wiki links with heading anchor", () => {
      const html = markdownToHtml("[[Page#Section]]");
      expect(html).toContain("wiki-link");
    });
  });

  describe("mermaid", () => {
    it("renders mermaid blocks", () => {
      const html = markdownToHtml("```mermaid\nflowchart LR\nA-->B\n```");
      expect(html).toContain('class="mermaid"');
      expect(html).toContain("flowchart LR");
      // The > in --> gets HTML-encoded to &gt;
      expect(html).toContain("A--&gt;B");
    });

    it("renders complex mermaid diagrams", () => {
      const md = "```mermaid\nsequenceDiagram\nAlice->>Bob: Hello\nBob->>Alice: Hi\n```";
      const html = markdownToHtml(md);
      expect(html).toContain("mermaid");
      expect(html).toContain("sequenceDiagram");
    });
  });

  describe("custom inline marks", () => {
    it("renders highlight", () => {
      const html = markdownToHtml("==highlighted==");
      expect(html).toContain("<mark>");
      expect(html).toContain("highlighted");
    });

    it("renders subscript", () => {
      const html = markdownToHtml("H~2~O");
      expect(html).toContain("<sub>");
      expect(html).toContain("2");
    });

    it("renders superscript", () => {
      const html = markdownToHtml("x^2^");
      expect(html).toContain("<sup>");
      expect(html).toContain("2");
    });

    it("renders underline", () => {
      const html = markdownToHtml("++underlined++");
      expect(html).toContain("<u>");
      expect(html).toContain("underlined");
    });

    it("renders strikethrough", () => {
      const html = markdownToHtml("~~deleted~~");
      expect(html).toContain("<del>");
      expect(html).toContain("deleted");
    });
  });
});

describe("generateHtmlDocument", () => {
  it("generates complete HTML document", () => {
    const html = generateHtmlDocument("# Hello", "Test Doc");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
    expect(html).toContain("<title>Test Doc</title>");
    expect(html).toContain("<h1>");
    expect(html).toContain("Hello");
  });

  it("includes styles by default", () => {
    const html = generateHtmlDocument("Hello", "Doc");
    expect(html).toContain("<style>");
  });

  it("excludes styles when requested", () => {
    const html = generateHtmlDocument("Hello", "Doc", false);
    expect(html).not.toContain("<style>");
  });

  it("escapes title to prevent XSS", () => {
    const html = generateHtmlDocument("Hello", "<script>alert('xss')</script>");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(escapeHtml('"quotes"')).toBe("&quot;quotes&quot;");
    expect(escapeHtml("'apostrophe'")).toBe("&#039;apostrophe&#039;");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("passes through safe strings", () => {
    expect(escapeHtml("Hello world")).toBe("Hello world");
  });
});

describe("export idempotence", () => {
  it("produces identical output for repeated exports", () => {
    const markdown = `# Title

Hello **world** with $E=mc^2$ math.

| A | B |
| --- | --- |
| 1 | 2 |

> [!NOTE]
> Important note

- Item 1
- Item 2
`;
    const html1 = markdownToHtml(markdown);
    const html2 = markdownToHtml(markdown);
    const html3 = markdownToHtml(markdown);

    expect(html1).toBe(html2);
    expect(html2).toBe(html3);
  });

  it("produces identical documents for repeated exports", () => {
    const markdown = "# Test\n\nContent with **bold**";
    const doc1 = generateHtmlDocument(markdown, "Test");
    const doc2 = generateHtmlDocument(markdown, "Test");

    expect(doc1).toBe(doc2);
  });
});

describe("complex document export", () => {
  it("exports document with all features", () => {
    const markdown = `---
title: Test Document
---

# Main Title

This is a paragraph with **bold**, *italic*, and ~~strikethrough~~.

## Math Section

Inline math: $E=mc^2$

Block math:
$$
\\int_0^\\infty e^{-x^2} dx
$$

## Table Section

| Column A | Column B |
| -------- | -------- |
| Value 1  | Value 2  |

## Footnotes

Here is a reference[^1].

[^1]: This is the footnote content.

## Alerts

> [!NOTE]
> This is a note alert.

## Code

\`\`\`javascript
function hello() {
  console.log("Hello");
}
\`\`\`

## Lists

- Item 1
  - Nested item
- Item 2

## Wiki Links

See [[Other Page|link text]].
`;

    const html = markdownToHtml(markdown);

    // Verify all major elements are present
    expect(html).toContain("<h1>");
    expect(html).toContain("<h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<del>strikethrough</del>");
    expect(html).toContain("math-inline");
    expect(html).toContain("math-block");
    expect(html).toContain("<table>");
    expect(html).toContain("footnote");
    expect(html).toContain("markdown-alert");
    expect(html).toContain("<pre>");
    expect(html).toContain("language-javascript");
    expect(html).toContain("<ul>");
    expect(html).toContain("wiki-link");
  });

  it("preserves content order", () => {
    const markdown = "# First\n\nMiddle\n\n# Last";
    const html = markdownToHtml(markdown);

    const firstIndex = html.indexOf("First");
    const middleIndex = html.indexOf("Middle");
    const lastIndex = html.indexOf("Last");

    expect(firstIndex).toBeLessThan(middleIndex);
    expect(middleIndex).toBeLessThan(lastIndex);
  });

  it("handles empty document", () => {
    const html = markdownToHtml("");
    expect(html).toBe("");
  });

  it("handles whitespace-only document", () => {
    const html = markdownToHtml("   \n\n   ");
    // Should produce minimal or empty output
    expect(html.trim()).toBe("");
  });
});

describe("security", () => {
  it("sanitizes script tags", () => {
    const html = markdownToHtml("<script>alert('xss')</script>");
    expect(html).not.toContain("<script>");
  });

  it("sanitizes onclick handlers", () => {
    const html = markdownToHtml('<div onclick="alert(1)">Click</div>');
    expect(html).not.toContain("onclick");
  });

  it("allows safe HTML elements", () => {
    const html = markdownToHtml("<details><summary>Info</summary>Content</details>");
    expect(html).toContain("<details");
    expect(html).toContain("<summary>");
  });
});
