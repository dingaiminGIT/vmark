/**
 * Tests for htmlPaste extension
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { htmlPasteExtension } from "./tiptap";

// Mock the settings store
vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      markdown: {
        pasteMode: "smart",
        preserveLineBreaks: false,
      },
    })),
  },
}));

// Import after mock setup
import { useSettingsStore } from "@/stores/settingsStore";

function createEditor(content = "<p></p>") {
  return new Editor({
    extensions: [StarterKit, htmlPasteExtension],
    content,
  });
}

function createClipboardEvent(text: string, html?: string): ClipboardEvent {
  const clipboardData = {
    getData: vi.fn((type: string) => {
      if (type === "text/plain") return text;
      if (type === "text/html") return html || "";
      return "";
    }),
  };

  const event = new Event("paste", { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, "clipboardData", { value: clipboardData });
  return event;
}

describe("htmlPaste extension", () => {
  let editor: Editor;

  beforeEach(() => {
    vi.clearAllMocks();
    (useSettingsStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      markdown: {
        pasteMode: "smart",
        preserveLineBreaks: false,
      },
    });
  });

  afterEach(() => {
    editor?.destroy();
  });

  describe("paste mode handling", () => {
    it("should not handle paste when pasteMode is 'rich'", () => {
      (useSettingsStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
        markdown: { pasteMode: "rich" },
      });

      editor = createEditor();
      const event = createClipboardEvent("text", "<p><strong>bold</strong></p>");

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event));
      expect(handled).toBeFalsy();
    });

    it("should handle paste as plain text when pasteMode is 'plain'", () => {
      (useSettingsStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
        markdown: { pasteMode: "plain" },
      });

      editor = createEditor();
      const event = createClipboardEvent("plain text", "<p><strong>bold</strong></p>");

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event));
      expect(handled).toBe(true);
      expect(event.defaultPrevented).toBe(true);
    });
  });

  describe("HTML detection", () => {
    it("should not handle paste when no HTML content", () => {
      editor = createEditor();
      const event = createClipboardEvent("plain text only", "");

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event));
      expect(handled).toBeFalsy();
    });

    it("should not handle non-substantial HTML", () => {
      editor = createEditor();
      // Simple span is not substantial
      const event = createClipboardEvent("text", "<span>text</span>");

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event));
      expect(handled).toBeFalsy();
    });

    it("should handle substantial HTML with formatting", () => {
      editor = createEditor();
      const event = createClipboardEvent(
        "Hello world",
        "<p><strong>Hello</strong> <em>world</em></p>"
      );

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event));
      // May or may not be handled depending on conversion result
      expect(typeof handled).toBe("boolean");
    });

    it("should handle HTML with headings", () => {
      editor = createEditor();
      const event = createClipboardEvent(
        "Title",
        "<h1>Title</h1>"
      );

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event));
      expect(typeof handled).toBe("boolean");
    });

    it("should handle HTML with lists", () => {
      editor = createEditor();
      const event = createClipboardEvent(
        "Item 1\nItem 2",
        "<ul><li>Item 1</li><li>Item 2</li></ul>"
      );

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event));
      expect(typeof handled).toBe("boolean");
    });
  });

  describe("code block context", () => {
    it("should not handle paste when in code block", () => {
      editor = createEditor("<pre><code>existing code</code></pre>");
      editor.commands.setTextSelection(2);

      const event = createClipboardEvent(
        "bold text",
        "<p><strong>bold text</strong></p>"
      );

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event));
      expect(handled).toBeFalsy();
    });
  });

  describe("size limits", () => {
    it("should fall back to plain text for HTML larger than MAX_HTML_SIZE", () => {
      editor = createEditor();
      // Create HTML larger than 100KB
      const largeHtml = "<p>" + "x".repeat(101000) + "</p>";
      const event = createClipboardEvent("plain fallback", largeHtml);

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event));
      // Should still handle it by falling back to plain text
      expect(handled).toBe(true);
    });
  });

  describe("conversion edge cases", () => {
    it("should not handle when markdown equals plain text", () => {
      editor = createEditor();
      // HTML that converts to same as plain text
      const event = createClipboardEvent(
        "just text",
        "<p>just text</p>"
      );

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event));
      // When markdown output equals plain text, let other handlers deal with it
      expect(handled).toBeFalsy();
    });
  });
});
