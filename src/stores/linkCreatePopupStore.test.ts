import { beforeEach, describe, expect, it } from "vitest";
import { useLinkCreatePopupStore } from "./linkCreatePopupStore";

const rect = { top: 100, left: 200, bottom: 120, right: 300 };

describe("linkCreatePopupStore", () => {
  beforeEach(() => {
    useLinkCreatePopupStore.getState().closePopup();
  });

  it("opens popup with text and range", () => {
    useLinkCreatePopupStore.getState().openPopup({
      text: "example",
      rangeFrom: 10,
      rangeTo: 17,
      anchorRect: rect,
      showTextInput: true,
    });

    const state = useLinkCreatePopupStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.text).toBe("example");
    expect(state.url).toBe("");
    expect(state.rangeFrom).toBe(10);
    expect(state.rangeTo).toBe(17);
    expect(state.anchorRect).toEqual(rect);
    expect(state.showTextInput).toBe(true);
  });

  it("opens popup without text input when selection exists", () => {
    useLinkCreatePopupStore.getState().openPopup({
      text: "selected text",
      rangeFrom: 0,
      rangeTo: 13,
      anchorRect: rect,
      showTextInput: false,
    });

    const state = useLinkCreatePopupStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.text).toBe("selected text");
    expect(state.showTextInput).toBe(false);
  });

  it("closes popup and resets state", () => {
    useLinkCreatePopupStore.getState().openPopup({
      text: "test",
      rangeFrom: 0,
      rangeTo: 4,
      anchorRect: rect,
      showTextInput: true,
    });
    useLinkCreatePopupStore.getState().closePopup();

    const state = useLinkCreatePopupStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.text).toBe("");
    expect(state.url).toBe("");
    expect(state.rangeFrom).toBe(0);
    expect(state.rangeTo).toBe(0);
    expect(state.anchorRect).toBeNull();
    expect(state.showTextInput).toBe(true);
  });

  it("updates text field", () => {
    useLinkCreatePopupStore.getState().openPopup({
      text: "original",
      rangeFrom: 0,
      rangeTo: 8,
      anchorRect: rect,
      showTextInput: true,
    });
    useLinkCreatePopupStore.getState().setText("modified");

    expect(useLinkCreatePopupStore.getState().text).toBe("modified");
  });

  it("updates url field", () => {
    useLinkCreatePopupStore.getState().openPopup({
      text: "link",
      rangeFrom: 0,
      rangeTo: 4,
      anchorRect: rect,
      showTextInput: true,
    });
    useLinkCreatePopupStore.getState().setUrl("https://example.com");

    expect(useLinkCreatePopupStore.getState().url).toBe("https://example.com");
  });

  it("resets url when reopening popup", () => {
    useLinkCreatePopupStore.getState().openPopup({
      text: "first",
      rangeFrom: 0,
      rangeTo: 5,
      anchorRect: rect,
      showTextInput: true,
    });
    useLinkCreatePopupStore.getState().setUrl("https://first.com");

    // Reopen popup - url should reset
    useLinkCreatePopupStore.getState().openPopup({
      text: "second",
      rangeFrom: 10,
      rangeTo: 16,
      anchorRect: rect,
      showTextInput: true,
    });

    const state = useLinkCreatePopupStore.getState();
    expect(state.text).toBe("second");
    expect(state.url).toBe("");
  });
});
