import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MathPreviewView, getMathPreviewView } from "./MathPreviewView";

// Mock KaTeX loader
vi.mock("@/plugins/latex/katexLoader", () => ({
  loadKatex: vi.fn(() =>
    Promise.resolve({
      default: {
        render: vi.fn((content: string, element: HTMLElement, options: { throwOnError?: boolean }) => {
          if (options?.throwOnError && content === "\\invalid") {
            throw new Error("Unknown macro: \\invalid");
          }
          element.innerHTML = `<span class="katex">${content}</span>`;
        }),
      },
    })
  ),
}));

// Mock popup position utils
vi.mock("@/utils/popupPosition", () => ({
  calculatePopupPosition: vi.fn(() => ({ top: 100, left: 200 })),
  getBoundaryRects: vi.fn(() => ({ top: 0, left: 0, bottom: 800, right: 1200 })),
  getViewportBounds: vi.fn(() => ({ top: 0, left: 0, bottom: 800, right: 1200 })),
}));

// Mock sourcePopup utils
vi.mock("@/plugins/sourcePopup", () => ({
  getPopupHostForDom: vi.fn(() => null),
  toHostCoordsForDom: vi.fn((_host, pos) => pos),
}));

describe("MathPreviewView", () => {
  let view: MathPreviewView;

  beforeEach(() => {
    view = new MathPreviewView();
  });

  afterEach(() => {
    view.destroy();
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("creates container with correct structure", () => {
      // Access internal container via show() side effect
      const anchorRect = { top: 50, left: 100, bottom: 70, right: 200 };
      view.show("x+y", anchorRect);

      const container = document.querySelector(".math-preview-popup");
      expect(container).not.toBeNull();
      expect(container?.querySelector(".math-preview-content")).not.toBeNull();
      expect(container?.querySelector(".math-preview-error")).not.toBeNull();
    });
  });

  describe("show", () => {
    it("makes popup visible", () => {
      expect(view.isVisible()).toBe(false);

      view.show("x+y", { top: 50, left: 100, bottom: 70, right: 200 });

      expect(view.isVisible()).toBe(true);
    });

    it("appends container to document.body by default", () => {
      view.show("x+y", { top: 50, left: 100, bottom: 70, right: 200 });

      const container = document.body.querySelector(".math-preview-popup");
      expect(container).not.toBeNull();
    });

    it("sets container display to block", () => {
      view.show("x+y", { top: 50, left: 100, bottom: 70, right: 200 });

      const container = document.querySelector(".math-preview-popup") as HTMLElement;
      expect(container.style.display).toBe("block");
    });
  });

  describe("hide", () => {
    it("hides the popup", () => {
      view.show("x+y", { top: 50, left: 100, bottom: 70, right: 200 });
      expect(view.isVisible()).toBe(true);

      view.hide();

      expect(view.isVisible()).toBe(false);
    });

    it("sets container display to none", () => {
      view.show("x+y", { top: 50, left: 100, bottom: 70, right: 200 });
      view.hide();

      const container = document.querySelector(".math-preview-popup") as HTMLElement;
      expect(container.style.display).toBe("none");
    });
  });

  describe("isVisible", () => {
    it("returns false initially", () => {
      expect(view.isVisible()).toBe(false);
    });

    it("returns true after show", () => {
      view.show("x", { top: 0, left: 0, bottom: 0, right: 0 });
      expect(view.isVisible()).toBe(true);
    });

    it("returns false after hide", () => {
      view.show("x", { top: 0, left: 0, bottom: 0, right: 0 });
      view.hide();
      expect(view.isVisible()).toBe(false);
    });
  });

  describe("updateContent", () => {
    it("updates rendered content", async () => {
      view.show("x", { top: 0, left: 0, bottom: 0, right: 0 });

      view.updateContent("y+z");

      // Wait for async rendering
      await vi.waitFor(() => {
        const content = document.querySelector(".math-preview-content");
        return content?.innerHTML.includes("y+z");
      });

      const content = document.querySelector(".math-preview-content");
      expect(content?.innerHTML).toContain("y+z");
    });
  });

  describe("renderPreview", () => {
    it("renders empty state for whitespace-only content", async () => {
      view.show("   ", { top: 0, left: 0, bottom: 0, right: 0 });

      const content = document.querySelector(".math-preview-content");
      expect(content?.classList.contains("math-preview-empty")).toBe(true);
      expect(content?.textContent).toBe("");
    });

    it("renders KaTeX for valid content", async () => {
      view.show("x^2", { top: 0, left: 0, bottom: 0, right: 0 });

      await vi.waitFor(() => {
        const content = document.querySelector(".math-preview-content");
        return content?.innerHTML.includes("katex");
      });

      const content = document.querySelector(".math-preview-content");
      expect(content?.innerHTML).toContain("katex");
    });

    it("shows error for invalid LaTeX", async () => {
      view.show("\\invalid", { top: 0, left: 0, bottom: 0, right: 0 });

      await vi.waitFor(() => {
        const error = document.querySelector(".math-preview-error");
        return (error?.textContent?.length ?? 0) > 0;
      });

      const error = document.querySelector(".math-preview-error");
      expect(error?.textContent).toContain("Invalid LaTeX");

      const content = document.querySelector(".math-preview-content");
      expect(content?.classList.contains("math-preview-error-state")).toBe(true);
    });

    it("cancels stale renders via token", async () => {
      view.show("first", { top: 0, left: 0, bottom: 0, right: 0 });
      view.updateContent("second");
      view.updateContent("third");

      await vi.waitFor(() => {
        const content = document.querySelector(".math-preview-content");
        return content?.innerHTML.includes("third");
      });

      const content = document.querySelector(".math-preview-content");
      // Only the last content should be rendered
      expect(content?.innerHTML).toContain("third");
    });
  });

  describe("destroy", () => {
    it("removes container from DOM", () => {
      view.show("x", { top: 0, left: 0, bottom: 0, right: 0 });
      expect(document.querySelector(".math-preview-popup")).not.toBeNull();

      view.destroy();

      expect(document.querySelector(".math-preview-popup")).toBeNull();
    });
  });

  describe("getMathPreviewView singleton", () => {
    afterEach(() => {
      // Reset module to clear singleton
      vi.resetModules();
    });

    it("returns same instance on multiple calls", async () => {
      const { getMathPreviewView: getView1 } = await import("./MathPreviewView");
      const { getMathPreviewView: getView2 } = await import("./MathPreviewView");

      const instance1 = getView1();
      const instance2 = getView2();

      expect(instance1).toBe(instance2);
    });

    it("returns a MathPreviewView instance", () => {
      const instance = getMathPreviewView();
      expect(instance).toBeInstanceOf(MathPreviewView);
    });
  });
});
