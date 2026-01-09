/**
 * Tests for saveToPath helper
 *
 * @module utils/saveToPath.test
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveToPath } from "./saveToPath";

vi.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: vi.fn(),
}));

vi.mock("@/hooks/useHistoryOperations", () => ({
  createSnapshot: vi.fn(),
}));

vi.mock("@/stores/documentStore", () => ({
  useDocumentStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@/stores/tabStore", () => ({
  useTabStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@/stores/recentFilesStore", () => ({
  useRecentFilesStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: {
    getState: vi.fn(),
  },
}));

import { writeTextFile } from "@tauri-apps/plugin-fs";
import { createSnapshot } from "@/hooks/useHistoryOperations";
import { useDocumentStore } from "@/stores/documentStore";
import { useTabStore } from "@/stores/tabStore";
import { useRecentFilesStore } from "@/stores/recentFilesStore";
import { useSettingsStore } from "@/stores/settingsStore";

describe("saveToPath", () => {
  const mockSetFilePath = vi.fn();
  const mockMarkSaved = vi.fn();
  const mockUpdateTabPath = vi.fn();
  const mockAddFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDocumentStore.getState).mockReturnValue({
      setFilePath: mockSetFilePath,
      markSaved: mockMarkSaved,
    } as unknown as ReturnType<typeof useDocumentStore.getState>);
    vi.mocked(useTabStore.getState).mockReturnValue({
      updateTabPath: mockUpdateTabPath,
    } as unknown as ReturnType<typeof useTabStore.getState>);
    vi.mocked(useRecentFilesStore.getState).mockReturnValue({
      addFile: mockAddFile,
    } as unknown as ReturnType<typeof useRecentFilesStore.getState>);
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      general: {
        historyEnabled: true,
        historyMaxSnapshots: 5,
        historyMaxAgeDays: 30,
      },
    } as unknown as ReturnType<typeof useSettingsStore.getState>);
  });

  it("writes content and updates stores on success", async () => {
    vi.mocked(writeTextFile).mockResolvedValue(undefined);

    const result = await saveToPath("tab-1", "/tmp/doc.md", "Hello", "manual");

    expect(result).toBe(true);
    expect(writeTextFile).toHaveBeenCalledWith("/tmp/doc.md", "Hello");
    expect(mockSetFilePath).toHaveBeenCalledWith("tab-1", "/tmp/doc.md");
    expect(mockMarkSaved).toHaveBeenCalledWith("tab-1");
    expect(mockUpdateTabPath).toHaveBeenCalledWith("tab-1", "/tmp/doc.md");
    expect(mockAddFile).toHaveBeenCalledWith("/tmp/doc.md");
    expect(createSnapshot).toHaveBeenCalledWith("/tmp/doc.md", "Hello", "manual", {
      maxSnapshots: 5,
      maxAgeDays: 30,
    });
  });

  it("skips history snapshot when disabled", async () => {
    vi.mocked(writeTextFile).mockResolvedValue(undefined);
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      general: {
        historyEnabled: false,
        historyMaxSnapshots: 5,
        historyMaxAgeDays: 30,
      },
    } as unknown as ReturnType<typeof useSettingsStore.getState>);

    const result = await saveToPath("tab-2", "/tmp/disabled.md", "No history", "manual");

    expect(result).toBe(true);
    expect(createSnapshot).not.toHaveBeenCalled();
  });

  it("returns false and skips updates when write fails", async () => {
    vi.mocked(writeTextFile).mockRejectedValue(new Error("disk error"));

    const result = await saveToPath("tab-3", "/tmp/fail.md", "fail", "manual");

    expect(result).toBe(false);
    expect(mockSetFilePath).not.toHaveBeenCalled();
    expect(mockMarkSaved).not.toHaveBeenCalled();
    expect(mockUpdateTabPath).not.toHaveBeenCalled();
    expect(mockAddFile).not.toHaveBeenCalled();
    expect(createSnapshot).not.toHaveBeenCalled();
  });
});
