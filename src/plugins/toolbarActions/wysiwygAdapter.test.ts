import { describe, it, expect, vi, beforeEach } from "vitest";
import { performWysiwygToolbarAction } from "./wysiwygAdapter";
import { emit } from "@tauri-apps/api/event";

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({ label: "main" }),
}));

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

  it("emits alert menu events for each alert type action", () => {
    const actions: Record<string, string> = {
      insertAlertNote: "menu:info-note",
      insertAlertTip: "menu:info-tip",
      insertAlertImportant: "menu:info-important",
      insertAlertWarning: "menu:info-warning",
      insertAlertCaution: "menu:info-caution",
    };

    for (const [action, eventName] of Object.entries(actions)) {
      performWysiwygToolbarAction(action, baseContext);
      expect(emit).toHaveBeenLastCalledWith(eventName, "main");
    }
  });
});
