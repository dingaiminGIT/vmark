import { describe, expect, it, vi } from "vitest";
import type { Editor as TiptapEditor } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";
import { scheduleTiptapFocusAndRestore } from "./tiptapFocus";

describe("scheduleTiptapFocusAndRestore", () => {
  it("focuses and restores once the view is connected", () => {
    const focus = vi.fn();
    const view = {
      dom: { isConnected: true },
      focus,
    } as unknown as EditorView;

    const editor = {
      isDestroyed: false,
      view,
    } as TiptapEditor;

    const restoreCursor = vi.fn();
    const getCursorInfo = vi.fn().mockReturnValue({
      contentLineIndex: 0,
      wordAtCursor: "",
      offsetInWord: 0,
      nodeType: "paragraph",
      percentInLine: 0,
      contextBefore: "",
      contextAfter: "",
    });

    const raf = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = raf;

    scheduleTiptapFocusAndRestore(editor, getCursorInfo, restoreCursor);

    globalThis.requestAnimationFrame = originalRaf;

    expect(focus).toHaveBeenCalledTimes(1);
    expect(restoreCursor).toHaveBeenCalledTimes(1);
  });

  it("bails out when the editor is destroyed", () => {
    const editor = {
      isDestroyed: true,
      view: undefined,
    } as unknown as TiptapEditor;

    const restoreCursor = vi.fn();
    const getCursorInfo = vi.fn().mockReturnValue(null);

    const raf = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = raf;

    scheduleTiptapFocusAndRestore(editor, getCursorInfo, restoreCursor);

    globalThis.requestAnimationFrame = originalRaf;

    expect(restoreCursor).not.toHaveBeenCalled();
  });

  it("handles fresh document load (null cursor info) with scroll preservation", () => {
    const focus = vi.fn();
    const dispatch = vi.fn();
    const mockDoc = { content: { size: 10 } };
    const view = {
      dom: { isConnected: true, parentElement: null },
      focus,
      dispatch,
      state: {
        doc: mockDoc,
        tr: {
          setSelection: vi.fn().mockReturnThis(),
        },
      },
    } as unknown as EditorView;

    const editor = {
      isDestroyed: false,
      view,
    } as TiptapEditor;

    const restoreCursor = vi.fn();
    const getCursorInfo = vi.fn().mockReturnValue(null);

    const raf = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = raf;

    scheduleTiptapFocusAndRestore(editor, getCursorInfo, restoreCursor);

    globalThis.requestAnimationFrame = originalRaf;

    expect(focus).toHaveBeenCalledTimes(1);
    expect(restoreCursor).not.toHaveBeenCalled();
  });

  it("retries when view is not connected", () => {
    let callCount = 0;
    const focus = vi.fn();

    // View starts disconnected, becomes connected on 2nd attempt
    const view = {
      dom: {
        get isConnected() {
          // First call (callCount=1): false, second call (callCount=2): true
          return callCount >= 2;
        },
        parentElement: null,
      },
      focus,
      dispatch: vi.fn(),
      state: {
        doc: { content: { size: 10 } },
        tr: { setSelection: vi.fn().mockReturnThis() },
      },
    } as unknown as EditorView;

    const editor = {
      isDestroyed: false,
      view,
    } as TiptapEditor;

    const restoreCursor = vi.fn();
    const getCursorInfo = vi.fn().mockReturnValue(null);

    const raf = vi.fn((cb: FrameRequestCallback) => {
      callCount++;
      cb(0);
      return callCount;
    });
    const originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = raf;

    scheduleTiptapFocusAndRestore(editor, getCursorInfo, restoreCursor);

    globalThis.requestAnimationFrame = originalRaf;

    // Should have retried 2 times (1 fail + 1 success)
    expect(raf).toHaveBeenCalledTimes(2);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("stops retrying after max attempts", () => {
    const focus = vi.fn();
    const view = {
      dom: { isConnected: false },
      focus,
    } as unknown as EditorView;

    const editor = {
      isDestroyed: false,
      view,
    } as TiptapEditor;

    const restoreCursor = vi.fn();
    const getCursorInfo = vi.fn().mockReturnValue(null);

    let callCount = 0;
    const raf = vi.fn((cb: FrameRequestCallback) => {
      callCount++;
      cb(0);
      return callCount;
    });
    const originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = raf;

    scheduleTiptapFocusAndRestore(editor, getCursorInfo, restoreCursor);

    globalThis.requestAnimationFrame = originalRaf;

    // Should stop at MAX_FOCUS_ATTEMPTS (12)
    expect(raf).toHaveBeenCalledTimes(12);
    expect(focus).not.toHaveBeenCalled();
  });

  it("handles focus throwing an error gracefully", () => {
    const focus = vi.fn(() => {
      throw new Error("Focus failed");
    });
    const view = {
      dom: { isConnected: true, parentElement: null },
      focus,
    } as unknown as EditorView;

    const editor = {
      isDestroyed: false,
      view,
    } as TiptapEditor;

    const restoreCursor = vi.fn();
    const getCursorInfo = vi.fn().mockReturnValue({
      contentLineIndex: 0,
      wordAtCursor: "",
      offsetInWord: 0,
      nodeType: "paragraph",
      percentInLine: 0,
      contextBefore: "",
      contextAfter: "",
    });

    const raf = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = raf;

    // Should not throw
    expect(() => {
      scheduleTiptapFocusAndRestore(editor, getCursorInfo, restoreCursor);
    }).not.toThrow();

    globalThis.requestAnimationFrame = originalRaf;

    expect(focus).toHaveBeenCalledTimes(1);
    // restoreCursor should not be called when focus fails
    expect(restoreCursor).not.toHaveBeenCalled();
  });

  it("handles focus error in fresh document load path", () => {
    const focus = vi.fn(() => {
      throw new Error("Focus failed");
    });
    const dispatch = vi.fn();
    const view = {
      dom: { isConnected: true, parentElement: null },
      focus,
      dispatch,
      state: {
        doc: { content: { size: 10 } },
        tr: { setSelection: vi.fn().mockReturnThis() },
      },
    } as unknown as EditorView;

    const editor = {
      isDestroyed: false,
      view,
    } as TiptapEditor;

    const restoreCursor = vi.fn();
    const getCursorInfo = vi.fn().mockReturnValue(null);

    const raf = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = raf;

    expect(() => {
      scheduleTiptapFocusAndRestore(editor, getCursorInfo, restoreCursor);
    }).not.toThrow();

    globalThis.requestAnimationFrame = originalRaf;

    expect(focus).toHaveBeenCalledTimes(1);
    // dispatch should not be called when focus fails
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("preserves scroll position on fresh document load", () => {
    const focus = vi.fn();
    const dispatch = vi.fn();
    let scrollTop = 100; // Simulated scroll position
    const scrollContainer = {
      get scrollTop() {
        return scrollTop;
      },
      set scrollTop(val: number) {
        scrollTop = val;
      },
      style: { overflowY: "auto" },
    };
    const view = {
      dom: {
        isConnected: true,
        parentElement: scrollContainer,
        style: { overflowY: "visible" },
      },
      focus,
      dispatch,
      state: {
        doc: { content: { size: 10 } },
        tr: { setSelection: vi.fn().mockReturnThis() },
      },
    } as unknown as EditorView;

    const editor = {
      isDestroyed: false,
      view,
    } as TiptapEditor;

    const restoreCursor = vi.fn();
    const getCursorInfo = vi.fn().mockReturnValue(null);

    const raf = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = raf;

    scheduleTiptapFocusAndRestore(editor, getCursorInfo, restoreCursor);

    globalThis.requestAnimationFrame = originalRaf;

    // Scroll position should be preserved
    expect(scrollTop).toBe(100);
  });

  it("handles setSelection throwing an error gracefully", () => {
    const focus = vi.fn();
    const dispatch = vi.fn();
    const view = {
      dom: { isConnected: true, parentElement: null },
      focus,
      dispatch,
      state: {
        doc: { content: { size: 10 } },
        tr: {
          setSelection: vi.fn(() => {
            throw new Error("Selection failed");
          }),
        },
      },
    } as unknown as EditorView;

    const editor = {
      isDestroyed: false,
      view,
    } as TiptapEditor;

    const restoreCursor = vi.fn();
    const getCursorInfo = vi.fn().mockReturnValue(null);

    const raf = vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    const originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = raf;

    // Should not throw
    expect(() => {
      scheduleTiptapFocusAndRestore(editor, getCursorInfo, restoreCursor);
    }).not.toThrow();

    globalThis.requestAnimationFrame = originalRaf;

    expect(focus).toHaveBeenCalledTimes(1);
  });
});
