import { beforeEach, describe, expect, it } from "vitest";
import { useHtmlBlockPopupStore } from "@/stores/htmlBlockPopupStore";

const rect = { top: 0, left: 0, bottom: 1, right: 1 };

describe("htmlBlockPopupStore", () => {
  beforeEach(() => {
    useHtmlBlockPopupStore.getState().closePopup();
  });

  it("opens with html content", () => {
    useHtmlBlockPopupStore.getState().openPopup(rect, "<div>Hi</div>", 3);
    const state = useHtmlBlockPopupStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.html).toBe("<div>Hi</div>");
    expect(state.nodePos).toBe(3);
    expect(state.anchorRect).toEqual(rect);
  });

  it("updates html", () => {
    useHtmlBlockPopupStore.getState().openPopup(rect, "<p>a</p>", 1);
    useHtmlBlockPopupStore.getState().updateHtml("<p>b</p>");
    expect(useHtmlBlockPopupStore.getState().html).toBe("<p>b</p>");
  });

  it("closes and resets state", () => {
    useHtmlBlockPopupStore.getState().openPopup(rect, "<p>a</p>", 1);
    useHtmlBlockPopupStore.getState().closePopup();
    const state = useHtmlBlockPopupStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.html).toBe("");
    expect(state.nodePos).toBeNull();
    expect(state.anchorRect).toBeNull();
  });
});
