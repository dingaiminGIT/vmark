/**
 * Tests for HTML sanitization utilities.
 */

import { describe, it, expect } from "vitest";
import {
  sanitizeHtml,
  sanitizeHtmlPreview,
  sanitizeSvg,
  sanitizeKatex,
  escapeHtml,
} from "./sanitize";

describe("sanitizeHtml", () => {
  it("allows safe HTML tags", () => {
    const html = "<p>Hello <strong>world</strong></p>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("allows common formatting elements", () => {
    const html = "<p><em>italic</em> <code>code</code> <u>underline</u></p>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("removes script tags", () => {
    const html = '<p>Safe</p><script>alert("xss")</script>';
    expect(sanitizeHtml(html)).toBe("<p>Safe</p>");
  });

  it("removes event handlers", () => {
    const html = '<p onclick="alert(1)">Click me</p>';
    expect(sanitizeHtml(html)).toBe("<p>Click me</p>");
  });

  it("removes javascript: URLs in links", () => {
    const html = '<a href="javascript:alert(1)">Click</a>';
    expect(sanitizeHtml(html)).toBe("<a>Click</a>");
  });

  it("allows safe links", () => {
    const html = '<a href="https://example.com" target="_blank">Link</a>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("allows images with safe attributes", () => {
    const html = '<img src="image.png" alt="test" title="Image">';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("removes onerror from images", () => {
    const html = '<img src="x" onerror="alert(1)">';
    expect(sanitizeHtml(html)).toBe('<img src="x">');
  });

  it("allows table elements", () => {
    const html = "<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("allows heading elements", () => {
    const html = "<h1>One</h1><h2>Two</h2><h3>Three</h3>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("allows lists", () => {
    const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("allows blockquote and hr", () => {
    const html = "<blockquote>Quote</blockquote><hr>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("allows sub and sup", () => {
    const html = "<p>H<sub>2</sub>O and x<sup>2</sup></p>";
    expect(sanitizeHtml(html)).toBe(html);
  });

  it("removes data attributes", () => {
    const html = '<div data-custom="value">Content</div>';
    expect(sanitizeHtml(html)).toBe("<div>Content</div>");
  });

  it("removes iframe elements", () => {
    const html = '<iframe src="https://evil.com"></iframe><p>Safe</p>';
    expect(sanitizeHtml(html)).toBe("<p>Safe</p>");
  });

  it("removes style tags", () => {
    const html = "<style>body { display: none }</style><p>Content</p>";
    expect(sanitizeHtml(html)).toBe("<p>Content</p>");
  });
});

describe("sanitizeHtmlPreview", () => {
  describe("inline context (default)", () => {
    it("allows inline tags", () => {
      const html = "<span><strong>Bold</strong> <em>Italic</em></span>";
      expect(sanitizeHtmlPreview(html)).toBe(html);
    });

    it("removes block tags in inline context", () => {
      const html = "<div><p>Paragraph</p></div>";
      const result = sanitizeHtmlPreview(html);
      expect(result).not.toContain("<div>");
      expect(result).not.toContain("<p>");
    });

    it("allows code but removes pre", () => {
      const html = "<pre><code>code</code></pre>";
      const result = sanitizeHtmlPreview(html);
      expect(result).toContain("<code>code</code>");
      expect(result).not.toContain("<pre>");
    });
  });

  describe("block context", () => {
    it("allows block tags", () => {
      const html = "<div><p>Paragraph</p></div>";
      const result = sanitizeHtmlPreview(html, { context: "block" });
      expect(result).toBe(html);
    });

    it("allows tables in block context", () => {
      const html = "<table><tr><td>Cell</td></tr></table>";
      const result = sanitizeHtmlPreview(html, { context: "block" });
      // DOMPurify normalizes tables by adding tbody
      expect(result).toContain("<table>");
      expect(result).toContain("<td>Cell</td>");
      expect(result).toContain("</table>");
    });

    it("allows pre/code in block context", () => {
      const html = "<pre><code>code</code></pre>";
      const result = sanitizeHtmlPreview(html, { context: "block" });
      expect(result).toBe(html);
    });
  });

  describe("style handling", () => {
    it("removes style attributes by default", () => {
      const html = '<span style="color: red">Red</span>';
      const result = sanitizeHtmlPreview(html);
      expect(result).toBe("<span>Red</span>");
    });

    it("allows safe style properties when enabled", () => {
      const html = '<span style="color: red; font-weight: bold">Styled</span>';
      const result = sanitizeHtmlPreview(html, { allowStyles: true });
      expect(result).toContain("color: red");
      expect(result).toContain("font-weight: bold");
    });

    it("filters out unsafe style properties", () => {
      const html = '<span style="background-image: url(evil.com); color: red">Text</span>';
      const result = sanitizeHtmlPreview(html, { allowStyles: true });
      expect(result).toContain("color: red");
      expect(result).not.toContain("background-image");
    });

    it("removes javascript from style values", () => {
      const html = '<span style="color: expression(alert(1))">Text</span>';
      const result = sanitizeHtmlPreview(html, { allowStyles: true });
      expect(result).not.toContain("expression");
    });

    it("removes url() from style values", () => {
      const html = '<span style="background-color: url(javascript:alert(1))">Text</span>';
      const result = sanitizeHtmlPreview(html, { allowStyles: true });
      expect(result).not.toContain("url");
    });
  });
});

describe("sanitizeSvg", () => {
  it("allows SVG elements", () => {
    const svg = '<svg><rect width="10" height="10"></rect></svg>';
    const result = sanitizeSvg(svg);
    expect(result).toContain("<svg>");
    expect(result).toContain("<rect");
  });

  it("removes script tags from SVG", () => {
    const svg = '<svg><script>alert(1)</script><rect></rect></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("<script>");
    expect(result).toContain("<rect");
  });

  it("removes event handlers from SVG", () => {
    const svg = '<svg onload="alert(1)"><rect onclick="alert(2)"></rect></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("onload");
    expect(result).not.toContain("onclick");
  });

  it("allows foreignObject for Mermaid diagrams", () => {
    const svg = "<svg><foreignObject><div>Text</div></foreignObject></svg>";
    const result = sanitizeSvg(svg);
    expect(result).toContain("foreignObject");
  });

  it("removes onerror handlers", () => {
    const svg = '<svg><image onerror="alert(1)"></image></svg>';
    const result = sanitizeSvg(svg);
    expect(result).not.toContain("onerror");
  });
});

describe("sanitizeKatex", () => {
  it("allows math elements", () => {
    const html = '<span class="katex"><math><mrow><mi>x</mi></mrow></math></span>';
    const result = sanitizeKatex(html);
    expect(result).toContain("<math>");
    expect(result).toContain("<mrow>");
    expect(result).toContain("<mi>x</mi>");
  });

  it("allows fraction elements inside math", () => {
    const html = "<math><mfrac><mn>1</mn><mn>2</mn></mfrac></math>";
    const result = sanitizeKatex(html);
    expect(result).toContain("<mfrac>");
    expect(result).toContain("<mn>1</mn>");
    expect(result).toContain("<mn>2</mn>");
  });

  it("allows sqrt and root inside math", () => {
    const html = "<math><msqrt><mn>2</mn></msqrt></math>";
    const result = sanitizeKatex(html);
    expect(result).toContain("<msqrt>");
    expect(result).toContain("<mn>2</mn>");
  });

  it("allows sub/superscript inside math", () => {
    const html = "<math><msup><mi>x</mi><mn>2</mn></msup></math>";
    const result = sanitizeKatex(html);
    expect(result).toContain("<msup>");
    expect(result).toContain("<mi>x</mi>");
  });

  it("allows span with class for KaTeX styling", () => {
    const html = '<span class="mord">x</span>';
    const result = sanitizeKatex(html);
    expect(result).toBe(html);
  });

  it("allows svg elements for line rendering", () => {
    const html = '<svg><line x1="0" y1="0" x2="10" y2="10"></line></svg>';
    const result = sanitizeKatex(html);
    expect(result).toContain("<line");
  });

  it("removes script elements", () => {
    const html = '<span class="katex"><script>alert(1)</script></span>';
    const result = sanitizeKatex(html);
    expect(result).not.toContain("<script>");
  });
});

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes less than", () => {
    expect(escapeHtml("a < b")).toBe("a &lt; b");
  });

  it("escapes greater than", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("escapes all special characters together", () => {
    const input = '<script>alert("xss") & more</script>';
    const expected = "&lt;script&gt;alert(&quot;xss&quot;) &amp; more&lt;/script&gt;";
    expect(escapeHtml(input)).toBe(expected);
  });

  it("returns original string if no special characters", () => {
    const input = "Hello World 123";
    expect(escapeHtml(input)).toBe(input);
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});
