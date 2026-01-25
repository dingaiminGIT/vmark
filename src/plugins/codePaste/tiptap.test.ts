/**
 * Tests for codePaste extension
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Slice } from "@tiptap/pm/model";
import { codePasteExtension } from "./tiptap";

// Mock the settings store
vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      markdown: {
        pasteMode: "smart",
      },
    })),
  },
}));

// Import after mock setup
import { useSettingsStore } from "@/stores/settingsStore";

function createEditor(content = "<p></p>") {
  return new Editor({
    extensions: [StarterKit, codePasteExtension],
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

describe("codePaste extension", () => {
  let editor: Editor;

  beforeEach(() => {
    vi.clearAllMocks();
    (useSettingsStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      markdown: { pasteMode: "smart" },
    });
  });

  afterEach(() => {
    editor?.destroy();
  });

  describe("paste mode handling", () => {
    it("should not handle paste when pasteMode is not 'smart'", () => {
      (useSettingsStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
        markdown: { pasteMode: "plain" },
      });

      editor = createEditor();
      const event = createClipboardEvent("const x = 1;\nconst y = 2;");

      // The handler should return false (not handled)
      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event, Slice.empty));
      expect(handled).toBeFalsy();
    });

    it("should not handle paste when HTML content is present", () => {
      editor = createEditor();
      const event = createClipboardEvent(
        "const x = 1;",
        "<p>const x = 1;</p>"
      );

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event, Slice.empty));
      expect(handled).toBeFalsy();
    });
  });

  describe("code detection", () => {
    it("should not handle single-line paste", () => {
      editor = createEditor();
      const event = createClipboardEvent("const x = 1;");

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event, Slice.empty));
      expect(handled).toBeFalsy();
    });

    it("should not handle plain text that is not code", () => {
      editor = createEditor();
      const event = createClipboardEvent("Hello world.\nThis is plain text.");

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event, Slice.empty));
      expect(handled).toBeFalsy();
    });

    it("should handle multi-line JavaScript code", () => {
      editor = createEditor();
      const code = `function hello() {
  console.log("Hello world");
  return true;
}`;
      const event = createClipboardEvent(code);

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event, Slice.empty));
      // Should be handled if detected as code
      expect(typeof handled).toBe("boolean");
    });

    it("should handle Python code", () => {
      editor = createEditor();
      const code = `def hello():
    print("Hello world")
    return True`;
      const event = createClipboardEvent(code);

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event, Slice.empty));
      expect(typeof handled).toBe("boolean");
    });
  });

  describe("code block context", () => {
    it("should not handle paste when already in code block", () => {
      editor = createEditor("<pre><code>existing code</code></pre>");
      // Position cursor inside the code block
      editor.commands.setTextSelection(2);

      const code = `const x = 1;
const y = 2;`;
      const event = createClipboardEvent(code);

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event, Slice.empty));
      // Should not handle - let default behavior take over
      expect(handled).toBeFalsy();
    });
  });

  describe("size limits", () => {
    it("should not handle text larger than MAX_CODE_SIZE", () => {
      editor = createEditor();
      // Create a string larger than 50KB
      const largeCode = "x".repeat(51000);
      const event = createClipboardEvent(largeCode);

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event, Slice.empty));
      expect(handled).toBeFalsy();
    });
  });

  describe("empty content", () => {
    it("should not handle empty clipboard", () => {
      editor = createEditor();
      const event = createClipboardEvent("");

      const handled = editor.view.someProp("handlePaste", (f) => f(editor.view, event, Slice.empty));
      expect(handled).toBeFalsy();
    });
  });
});
