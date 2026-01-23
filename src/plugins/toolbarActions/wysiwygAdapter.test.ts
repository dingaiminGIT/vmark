import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { performWysiwygToolbarAction } from "./wysiwygAdapter";

const baseContext = {
  surface: "wysiwyg" as const,
  view: null,
  editor: null,
  context: null,
};

describe("performWysiwygToolbarAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls alert insertion commands with the correct type", () => {
    const actions: Record<string, string> = {
      insertAlertNote: "NOTE",
      insertAlertTip: "TIP",
      insertAlertImportant: "IMPORTANT",
      insertAlertWarning: "WARNING",
      insertAlertCaution: "CAUTION",
    };

    for (const [action, alertType] of Object.entries(actions)) {
      const insertAlertBlock = vi.fn();
      const editor = { commands: { insertAlertBlock } } as unknown as TiptapEditor;
      const applied = performWysiwygToolbarAction(action, {
        ...baseContext,
        editor,
      });
      expect(applied).toBe(true);
      expect(insertAlertBlock).toHaveBeenCalledWith(alertType);
    }
  });
});
