import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isOperationInProgress,
  tryAcquireLock,
  releaseLock,
  withReentryGuard,
} from "./reentryGuard";

describe("reentryGuard", () => {
  beforeEach(() => {
    // Clean up any existing locks by releasing known test operations
    releaseLock("window1", "save");
    releaseLock("window1", "open");
    releaseLock("window2", "save");
    releaseLock("window2", "open");
    releaseLock("test-window", "test-op");
  });

  describe("isOperationInProgress", () => {
    it("returns false when no operation is in progress", () => {
      expect(isOperationInProgress("window1", "save")).toBe(false);
    });

    it("returns true when operation is in progress", () => {
      tryAcquireLock("window1", "save");
      expect(isOperationInProgress("window1", "save")).toBe(true);
    });

    it("returns false for different window with same operation", () => {
      tryAcquireLock("window1", "save");
      expect(isOperationInProgress("window2", "save")).toBe(false);
    });

    it("returns false for same window with different operation", () => {
      tryAcquireLock("window1", "save");
      expect(isOperationInProgress("window1", "open")).toBe(false);
    });

    it("returns false after lock is released", () => {
      tryAcquireLock("window1", "save");
      releaseLock("window1", "save");
      expect(isOperationInProgress("window1", "save")).toBe(false);
    });
  });

  describe("tryAcquireLock", () => {
    it("returns true when acquiring new lock", () => {
      expect(tryAcquireLock("window1", "save")).toBe(true);
    });

    it("returns false when lock already exists", () => {
      tryAcquireLock("window1", "save");
      expect(tryAcquireLock("window1", "save")).toBe(false);
    });

    it("allows acquiring different locks for same window", () => {
      expect(tryAcquireLock("window1", "save")).toBe(true);
      expect(tryAcquireLock("window1", "open")).toBe(true);
    });

    it("allows acquiring same lock for different windows", () => {
      expect(tryAcquireLock("window1", "save")).toBe(true);
      expect(tryAcquireLock("window2", "save")).toBe(true);
    });

    it("returns true after releasing and re-acquiring", () => {
      tryAcquireLock("window1", "save");
      releaseLock("window1", "save");
      expect(tryAcquireLock("window1", "save")).toBe(true);
    });
  });

  describe("releaseLock", () => {
    it("releases an existing lock", () => {
      tryAcquireLock("window1", "save");
      releaseLock("window1", "save");
      expect(isOperationInProgress("window1", "save")).toBe(false);
    });

    it("does nothing when releasing non-existent lock", () => {
      // Should not throw
      expect(() => releaseLock("window1", "nonexistent")).not.toThrow();
    });

    it("only releases the specified lock", () => {
      tryAcquireLock("window1", "save");
      tryAcquireLock("window1", "open");

      releaseLock("window1", "save");

      expect(isOperationInProgress("window1", "save")).toBe(false);
      expect(isOperationInProgress("window1", "open")).toBe(true);
    });

    it("does not affect locks for other windows", () => {
      tryAcquireLock("window1", "save");
      tryAcquireLock("window2", "save");

      releaseLock("window1", "save");

      expect(isOperationInProgress("window1", "save")).toBe(false);
      expect(isOperationInProgress("window2", "save")).toBe(true);
    });
  });

  describe("withReentryGuard", () => {
    it("executes function and returns result", async () => {
      const result = await withReentryGuard("window1", "save", async () => {
        return "success";
      });

      expect(result).toBe("success");
    });

    it("releases lock after function completes", async () => {
      await withReentryGuard("window1", "save", async () => "done");

      expect(isOperationInProgress("window1", "save")).toBe(false);
    });

    it("returns undefined when operation is already in progress", async () => {
      tryAcquireLock("window1", "save");

      const fn = vi.fn().mockResolvedValue("should not run");
      const result = await withReentryGuard("window1", "save", fn);

      expect(result).toBeUndefined();
      expect(fn).not.toHaveBeenCalled();
    });

    it("releases lock even when function throws", async () => {
      await expect(
        withReentryGuard("window1", "save", async () => {
          throw new Error("test error");
        })
      ).rejects.toThrow("test error");

      expect(isOperationInProgress("window1", "save")).toBe(false);
    });

    it("allows concurrent operations on different windows", async () => {
      const results: string[] = [];

      const p1 = withReentryGuard("window1", "save", async () => {
        results.push("window1-start");
        await new Promise((r) => setTimeout(r, 10));
        results.push("window1-end");
        return "window1";
      });

      const p2 = withReentryGuard("window2", "save", async () => {
        results.push("window2-start");
        await new Promise((r) => setTimeout(r, 5));
        results.push("window2-end");
        return "window2";
      });

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toBe("window1");
      expect(r2).toBe("window2");
      expect(results).toContain("window1-start");
      expect(results).toContain("window2-start");
    });

    it("allows different operations on same window concurrently", async () => {
      const results: string[] = [];

      const p1 = withReentryGuard("window1", "save", async () => {
        results.push("save-start");
        await new Promise((r) => setTimeout(r, 10));
        results.push("save-end");
        return "save";
      });

      const p2 = withReentryGuard("window1", "open", async () => {
        results.push("open-start");
        await new Promise((r) => setTimeout(r, 5));
        results.push("open-end");
        return "open";
      });

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toBe("save");
      expect(r2).toBe("open");
    });

    it("prevents re-entry during async operation", async () => {
      const callCount = { value: 0 };
      let resolveFirst: () => void;
      const firstBlocking = new Promise<void>((r) => {
        resolveFirst = r;
      });

      // Start first operation (will block)
      const p1 = withReentryGuard("window1", "save", async () => {
        callCount.value++;
        await firstBlocking;
        return "first";
      });

      // Try to start second operation (should be blocked)
      const p2 = withReentryGuard("window1", "save", async () => {
        callCount.value++;
        return "second";
      });

      // Second should return undefined immediately
      const result2 = await p2;
      expect(result2).toBeUndefined();
      expect(callCount.value).toBe(1);

      // Complete first operation
      resolveFirst!();
      const result1 = await p1;
      expect(result1).toBe("first");
      expect(callCount.value).toBe(1);
    });

    it("handles synchronous return values", async () => {
      const result = await withReentryGuard("window1", "sync", async () => {
        return 42;
      });

      expect(result).toBe(42);
    });

    it("handles void return", async () => {
      let executed = false;
      const result = await withReentryGuard("window1", "void", async () => {
        executed = true;
      });

      expect(executed).toBe(true);
      expect(result).toBeUndefined();
    });
  });

  describe("guard key composition", () => {
    it("uses window:operation format for uniqueness", () => {
      // These should all be independent locks
      tryAcquireLock("a", "b");
      tryAcquireLock("a:b", ""); // Different key pattern

      expect(isOperationInProgress("a", "b")).toBe(true);
      expect(isOperationInProgress("a:b", "")).toBe(true);
    });

    it("handles special characters in window labels", () => {
      expect(tryAcquireLock("window-1", "save")).toBe(true);
      expect(tryAcquireLock("window_2", "save")).toBe(true);
      expect(isOperationInProgress("window-1", "save")).toBe(true);
      expect(isOperationInProgress("window_2", "save")).toBe(true);
    });
  });
});
