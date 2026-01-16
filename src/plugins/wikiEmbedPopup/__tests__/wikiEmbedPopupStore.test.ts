import { beforeEach, describe, expect, it } from "vitest";
import { useWikiEmbedPopupStore } from "@/stores/wikiEmbedPopupStore";

const rect = { top: 5, left: 6, bottom: 7, right: 8 };

describe("wikiEmbedPopupStore", () => {
  beforeEach(() => {
    useWikiEmbedPopupStore.getState().closePopup();
  });

  it("opens with target and node position", () => {
    useWikiEmbedPopupStore.getState().openPopup(rect, "Page", 9);
    const state = useWikiEmbedPopupStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.target).toBe("Page");
    expect(state.nodePos).toBe(9);
    expect(state.anchorRect).toEqual(rect);
  });

  it("updates target", () => {
    useWikiEmbedPopupStore.getState().openPopup(rect, "A", 1);
    useWikiEmbedPopupStore.getState().updateTarget("B");
    expect(useWikiEmbedPopupStore.getState().target).toBe("B");
  });

  it("closes and resets state", () => {
    useWikiEmbedPopupStore.getState().openPopup(rect, "A", 1);
    useWikiEmbedPopupStore.getState().closePopup();
    const state = useWikiEmbedPopupStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.target).toBe("");
    expect(state.nodePos).toBeNull();
    expect(state.anchorRect).toBeNull();
  });
});
