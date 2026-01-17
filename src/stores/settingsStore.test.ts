import { beforeEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "./settingsStore";

beforeEach(() => {
  useSettingsStore.getState().resetSettings();
});

describe("settingsStore line break defaults", () => {
  it("sets default line ending and hard break style preferences", () => {
    const state = useSettingsStore.getState();
    expect(state.general.lineEndingsOnSave).toBe("preserve");
    expect(state.markdown.hardBreakStyleOnSave).toBe("preserve");
    expect(state.markdown.pasteMarkdownInWysiwyg).toBe("auto");
  });

  it("updates line ending preference", () => {
    const state = useSettingsStore.getState();
    state.updateGeneralSetting("lineEndingsOnSave", "crlf");
    expect(useSettingsStore.getState().general.lineEndingsOnSave).toBe("crlf");
  });

  it("updates hard break style preference", () => {
    const state = useSettingsStore.getState();
    state.updateMarkdownSetting("hardBreakStyleOnSave", "twoSpaces");
    expect(useSettingsStore.getState().markdown.hardBreakStyleOnSave).toBe("twoSpaces");
  });

  it("updates markdown paste preference", () => {
    const state = useSettingsStore.getState();
    state.updateMarkdownSetting("pasteMarkdownInWysiwyg", "off");
    expect(useSettingsStore.getState().markdown.pasteMarkdownInWysiwyg).toBe("off");
  });
});
