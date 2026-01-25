import { beforeEach, describe, expect, it } from "vitest";
import { useLinkTooltipStore } from "./linkTooltipStore";

const rect = { top: 100, left: 200, bottom: 120, right: 300 };

describe("linkTooltipStore", () => {
  beforeEach(() => {
    useLinkTooltipStore.getState().hideTooltip();
  });

  it("shows tooltip with href and anchor rect", () => {
    useLinkTooltipStore.getState().showTooltip({
      href: "https://example.com",
      anchorRect: rect,
    });

    const state = useLinkTooltipStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.href).toBe("https://example.com");
    expect(state.anchorRect).toEqual(rect);
  });

  it("hides tooltip and resets state", () => {
    useLinkTooltipStore.getState().showTooltip({
      href: "https://example.com",
      anchorRect: rect,
    });
    useLinkTooltipStore.getState().hideTooltip();

    const state = useLinkTooltipStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.href).toBe("");
    expect(state.anchorRect).toBeNull();
  });

  it("handles bookmark links", () => {
    useLinkTooltipStore.getState().showTooltip({
      href: "#section-heading",
      anchorRect: rect,
    });

    const state = useLinkTooltipStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.href).toBe("#section-heading");
  });

  it("updates when showing new tooltip", () => {
    useLinkTooltipStore.getState().showTooltip({
      href: "https://first.com",
      anchorRect: rect,
    });

    const newRect = { top: 200, left: 300, bottom: 220, right: 400 };
    useLinkTooltipStore.getState().showTooltip({
      href: "https://second.com",
      anchorRect: newRect,
    });

    const state = useLinkTooltipStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.href).toBe("https://second.com");
    expect(state.anchorRect).toEqual(newRect);
  });
});
