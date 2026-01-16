import { describe, it, expect, vi, beforeEach } from "vitest";
import { useLinkReferenceDialogStore } from "./linkReferenceDialogStore";

describe("linkReferenceDialogStore", () => {
  beforeEach(() => {
    useLinkReferenceDialogStore.getState().closeDialog();
  });

  it("opens dialog with selected text and callback", () => {
    const callback = vi.fn();
    useLinkReferenceDialogStore.getState().openDialog("some text", callback);

    const state = useLinkReferenceDialogStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.selectedText).toBe("some text");
    expect(state.onInsert).toBe(callback);
  });

  it("closes dialog and resets state", () => {
    const callback = vi.fn();
    useLinkReferenceDialogStore.getState().openDialog("text", callback);
    useLinkReferenceDialogStore.getState().closeDialog();

    const state = useLinkReferenceDialogStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.selectedText).toBe("");
    expect(state.onInsert).toBeNull();
  });

  it("insert calls callback and closes dialog", () => {
    const callback = vi.fn();
    useLinkReferenceDialogStore.getState().openDialog("link text", callback);
    useLinkReferenceDialogStore.getState().insert("my-ref", "https://example.com", "My Title");

    expect(callback).toHaveBeenCalledWith("my-ref", "https://example.com", "My Title");
    expect(useLinkReferenceDialogStore.getState().isOpen).toBe(false);
  });
});
