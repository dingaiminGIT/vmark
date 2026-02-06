import { describe, it, expect } from "vitest";
import { cleanMarkdownForClipboard } from "./tiptap";

describe("cleanMarkdownForClipboard", () => {
  describe("backslash escape stripping", () => {
    it("strips escaped dollar signs", () => {
      expect(cleanMarkdownForClipboard("Price is \\$99.99")).toBe(
        "Price is $99.99"
      );
    });

    it("strips escaped tildes", () => {
      expect(cleanMarkdownForClipboard("\\~20% off")).toBe("~20% off");
    });

    it("strips escaped at signs", () => {
      expect(cleanMarkdownForClipboard("user\\@example.com")).toBe(
        "user@example.com"
      );
    });

    it("strips escaped brackets", () => {
      expect(cleanMarkdownForClipboard("\\[not a link]")).toBe("[not a link]");
    });

    it("strips escaped asterisks", () => {
      expect(cleanMarkdownForClipboard("5 \\* 3 = 15")).toBe("5 * 3 = 15");
    });

    it("strips escaped underscores", () => {
      expect(cleanMarkdownForClipboard("snake\\_case")).toBe("snake_case");
    });

    it("strips escaped colons", () => {
      expect(cleanMarkdownForClipboard("https\\://example.com")).toBe(
        "https://example.com"
      );
    });

    it("strips escaped ampersands", () => {
      expect(cleanMarkdownForClipboard("foo\\&bar")).toBe("foo&bar");
    });

    it("converts double backslash to single", () => {
      expect(cleanMarkdownForClipboard("C:\\\\Users\\\\foo")).toBe(
        "C:\\Users\\foo"
      );
    });

    it("does not strip backslash before newline", () => {
      expect(cleanMarkdownForClipboard("line1\\\nline2")).toBe(
        "line1\\\nline2"
      );
    });

    it("handles multiple escapes in one line", () => {
      expect(
        cleanMarkdownForClipboard("\\$99 is \\~20% off\\!")
      ).toBe("$99 is ~20% off!");
    });
  });

  describe("autolink collapsing", () => {
    it("collapses URL autolinks", () => {
      expect(
        cleanMarkdownForClipboard(
          "[https://example.com/path](https://example.com/path)"
        )
      ).toBe("https://example.com/path");
    });

    it("collapses mailto autolinks", () => {
      expect(
        cleanMarkdownForClipboard(
          "[user@example.com](mailto:user@example.com)"
        )
      ).toBe("user@example.com");
    });

    it("collapses autolinks with escaped chars in text", () => {
      // Serializer escapes @ in text but not in URL
      expect(
        cleanMarkdownForClipboard(
          "[user\\@example.com](mailto:user@example.com)"
        )
      ).toBe("user@example.com");
    });

    it("collapses URL autolinks with escaped colons", () => {
      expect(
        cleanMarkdownForClipboard(
          "[https\\://example.com](https://example.com)"
        )
      ).toBe("https://example.com");
    });

    it("preserves real links where text differs from URL", () => {
      expect(
        cleanMarkdownForClipboard("[click here](https://example.com)")
      ).toBe("[click here](https://example.com)");
    });
  });

  describe("preserves markdown syntax", () => {
    it("preserves bold", () => {
      expect(cleanMarkdownForClipboard("**bold**")).toBe("**bold**");
    });

    it("preserves italic", () => {
      expect(cleanMarkdownForClipboard("*italic*")).toBe("*italic*");
    });

    it("preserves strikethrough", () => {
      expect(cleanMarkdownForClipboard("~~deleted~~")).toBe("~~deleted~~");
    });

    it("preserves code spans", () => {
      expect(cleanMarkdownForClipboard("`code`")).toBe("`code`");
    });

    it("preserves headings", () => {
      expect(cleanMarkdownForClipboard("## Heading")).toBe("## Heading");
    });

    it("preserves fenced code blocks", () => {
      const input = "```js\nconst x = 1;\n```";
      expect(cleanMarkdownForClipboard(input)).toBe(input);
    });
  });
});
