/**
 * Unit tests for reload guard logic
 */
import { describe, it, expect } from "vitest";
import {
  shouldBlockReload,
  getReloadWarningMessage,
  type ReloadGuardInput,
} from "./reloadGuard";

describe("reloadGuard", () => {
  describe("shouldBlockReload", () => {
    it("blocks reload when there are dirty documents", () => {
      const input: ReloadGuardInput = {
        dirtyTabIds: ["tab-1", "tab-2"],
      };
      const result = shouldBlockReload(input);
      expect(result.shouldBlock).toBe(true);
      if (result.shouldBlock) {
        expect(result.reason).toBe("unsaved_changes");
        expect(result.count).toBe(2);
      }
    });

    it("allows reload when no dirty documents", () => {
      const input: ReloadGuardInput = {
        dirtyTabIds: [],
      };
      const result = shouldBlockReload(input);
      expect(result.shouldBlock).toBe(false);
    });

    it("blocks reload for single dirty document", () => {
      const input: ReloadGuardInput = {
        dirtyTabIds: ["tab-1"],
      };
      const result = shouldBlockReload(input);
      expect(result.shouldBlock).toBe(true);
      if (result.shouldBlock) {
        expect(result.count).toBe(1);
      }
    });
  });

  describe("getReloadWarningMessage", () => {
    it("returns singular message for one document", () => {
      const message = getReloadWarningMessage(1);
      expect(message).toBe("You have unsaved changes. Are you sure you want to leave?");
    });

    it("returns plural message for multiple documents", () => {
      const message = getReloadWarningMessage(3);
      expect(message).toBe("You have 3 documents with unsaved changes. Are you sure you want to leave?");
    });

    it("returns plural message for two documents", () => {
      const message = getReloadWarningMessage(2);
      expect(message).toContain("2 documents");
    });
  });
});
