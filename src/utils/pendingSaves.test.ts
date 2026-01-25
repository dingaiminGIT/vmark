import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  registerPendingSave,
  clearPendingSave,
  isPendingSave,
  clearAllPendingSaves,
} from "./pendingSaves";

describe("pendingSaves", () => {
  beforeEach(() => {
    clearAllPendingSaves();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("registerPendingSave / isPendingSave", () => {
    it("returns true for a registered path", () => {
      registerPendingSave("/path/to/file.md");
      expect(isPendingSave("/path/to/file.md")).toBe(true);
    });

    it("returns false for an unregistered path", () => {
      expect(isPendingSave("/path/to/unknown.md")).toBe(false);
    });

    it("normalizes paths consistently", () => {
      // Register with forward slashes
      registerPendingSave("/path/to/file.md");
      // Check with same path
      expect(isPendingSave("/path/to/file.md")).toBe(true);
    });

    it("handles Windows-style paths", () => {
      registerPendingSave("C:\\Users\\test\\file.md");
      expect(isPendingSave("C:\\Users\\test\\file.md")).toBe(true);
    });
  });

  describe("clearPendingSave", () => {
    it("removes a registered path", () => {
      registerPendingSave("/path/to/file.md");
      expect(isPendingSave("/path/to/file.md")).toBe(true);

      clearPendingSave("/path/to/file.md");
      expect(isPendingSave("/path/to/file.md")).toBe(false);
    });

    it("does not affect other paths", () => {
      registerPendingSave("/path/to/file1.md");
      registerPendingSave("/path/to/file2.md");

      clearPendingSave("/path/to/file1.md");

      expect(isPendingSave("/path/to/file1.md")).toBe(false);
      expect(isPendingSave("/path/to/file2.md")).toBe(true);
    });
  });

  describe("TTL expiration", () => {
    it("returns true within TTL window", () => {
      registerPendingSave("/path/to/file.md");

      // Advance less than TTL (2000ms)
      vi.advanceTimersByTime(1000);

      expect(isPendingSave("/path/to/file.md")).toBe(true);
    });

    it("returns false after TTL expires", () => {
      registerPendingSave("/path/to/file.md");

      // Advance past TTL (2000ms)
      vi.advanceTimersByTime(2100);

      expect(isPendingSave("/path/to/file.md")).toBe(false);
    });

    it("cleans up expired entries on check", () => {
      registerPendingSave("/path/to/file.md");

      vi.advanceTimersByTime(2100);

      // First check should return false and clean up
      expect(isPendingSave("/path/to/file.md")).toBe(false);
      // Second check should also return false (entry was removed)
      expect(isPendingSave("/path/to/file.md")).toBe(false);
    });
  });

  describe("clearAllPendingSaves", () => {
    it("removes all registered paths", () => {
      registerPendingSave("/path/to/file1.md");
      registerPendingSave("/path/to/file2.md");
      registerPendingSave("/path/to/file3.md");

      clearAllPendingSaves();

      expect(isPendingSave("/path/to/file1.md")).toBe(false);
      expect(isPendingSave("/path/to/file2.md")).toBe(false);
      expect(isPendingSave("/path/to/file3.md")).toBe(false);
    });
  });

  describe("re-registration", () => {
    it("updates timestamp on re-registration", () => {
      registerPendingSave("/path/to/file.md");

      // Advance time close to expiration
      vi.advanceTimersByTime(1800);

      // Re-register (simulates another save)
      registerPendingSave("/path/to/file.md");

      // Advance another 1000ms (would be 2800ms from first registration)
      vi.advanceTimersByTime(1000);

      // Should still be valid because we re-registered
      expect(isPendingSave("/path/to/file.md")).toBe(true);
    });
  });
});
