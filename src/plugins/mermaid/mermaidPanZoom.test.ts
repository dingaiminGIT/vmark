/**
 * Tests for mermaidPanZoom utility.
 *
 * Mocks @panzoom/panzoom since jsdom lacks full SVG transform support.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Panzoom
const mockPanzoomInstance = {
  zoomWithWheel: vi.fn(),
  handleDown: vi.fn(),
  handleMove: vi.fn(),
  handleUp: vi.fn(),
  reset: vi.fn(),
  destroy: vi.fn(),
};

vi.mock("@panzoom/panzoom", () => ({
  default: vi.fn(() => mockPanzoomInstance),
}));

import { setupMermaidPanZoom } from "./mermaidPanZoom";

function createContainer(withSvg = true): HTMLElement {
  const container = document.createElement("div");
  if (withSvg) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", "100");
    rect.setAttribute("height", "50");
    svg.appendChild(rect);
    container.appendChild(svg);
  }
  return container;
}

describe("setupMermaidPanZoom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when container has no SVG", () => {
    const container = createContainer(false);
    const result = setupMermaidPanZoom(container);
    expect(result).toBeNull();
  });

  it("sets container overflow to hidden via inline style", () => {
    const container = createContainer();
    setupMermaidPanZoom(container);
    expect(container.style.overflow).toBe("hidden");
    expect(container.style.position).toBe("relative");
  });

  it("adds 'panzoom-enabled' class to container", () => {
    const container = createContainer();
    setupMermaidPanZoom(container);
    expect(container.classList.contains("panzoom-enabled")).toBe(true);
  });

  it("creates reset button by default", () => {
    const container = createContainer();
    setupMermaidPanZoom(container);
    const btn = container.querySelector(".mermaid-panzoom-reset");
    expect(btn).not.toBeNull();
  });

  it("omits reset button when showResetButton is false", () => {
    const container = createContainer();
    setupMermaidPanZoom(container, { showResetButton: false });
    const btn = container.querySelector(".mermaid-panzoom-reset");
    expect(btn).toBeNull();
  });

  it("reset() calls panzoom reset with animate", () => {
    const container = createContainer();
    const instance = setupMermaidPanZoom(container)!;
    instance.reset();
    expect(mockPanzoomInstance.reset).toHaveBeenCalledWith({ animate: true });
  });

  it("destroy() removes button and restores container", () => {
    const container = createContainer();
    container.style.overflow = "auto";
    container.style.position = "";

    const instance = setupMermaidPanZoom(container)!;

    // Verify setup state
    expect(container.querySelector(".mermaid-panzoom-reset")).not.toBeNull();
    expect(container.style.overflow).toBe("hidden");

    instance.destroy();

    // After destroy: no button, class removed, styles restored
    expect(container.querySelector(".mermaid-panzoom-reset")).toBeNull();
    expect(container.classList.contains("panzoom-enabled")).toBe(false);
    expect(container.style.overflow).toBe("auto");
    expect(container.style.position).toBe("");
  });

  it("SVG children remain intact (no wrapping)", () => {
    const container = createContainer();
    setupMermaidPanZoom(container);
    const svg = container.querySelector("svg")!;
    expect(svg.querySelector("g.panzoom-target")).toBeNull();
    expect(svg.querySelector("rect")).not.toBeNull();
  });
});
