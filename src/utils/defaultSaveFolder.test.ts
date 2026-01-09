/**
 * Tests for default save folder resolution
 *
 * Tests the three-tier precedence:
 * 1. Workspace root (if in workspace mode)
 * 2. First saved tab's folder in the window
 * 3. Home directory
 *
 * @module utils/defaultSaveFolder.test
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDefaultSaveFolderWithFallback } from "./defaultSaveFolder";

// Mock Tauri path API
vi.mock("@tauri-apps/api/path", () => ({
  homeDir: vi.fn(),
}));

// Mock stores
vi.mock("@/stores/workspaceStore", () => ({
  useWorkspaceStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@/stores/tabStore", () => ({
  useTabStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@/stores/documentStore", () => ({
  useDocumentStore: {
    getState: vi.fn(),
  },
}));

import { homeDir } from "@tauri-apps/api/path";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useTabStore } from "@/stores/tabStore";
import { useDocumentStore } from "@/stores/documentStore";

describe("getDefaultSaveFolderWithFallback", () => {
  const mockHomeDir = vi.mocked(homeDir);
  const mockWorkspaceGetState = vi.mocked(useWorkspaceStore.getState);
  const mockTabGetState = vi.mocked(useTabStore.getState);
  const mockDocGetState = vi.mocked(useDocumentStore.getState);

  beforeEach(() => {
    vi.clearAllMocks();
    mockHomeDir.mockResolvedValue("/Users/test");
  });

  it("returns workspace root when in workspace mode", async () => {
    mockWorkspaceGetState.mockReturnValue({
      isWorkspaceMode: true,
      rootPath: "/workspace/project",
    } as ReturnType<typeof useWorkspaceStore.getState>);

    const result = await getDefaultSaveFolderWithFallback("main");

    expect(result).toBe("/workspace/project");
  });

  it("returns first saved tab folder when no workspace", async () => {
    mockWorkspaceGetState.mockReturnValue({
      isWorkspaceMode: false,
      rootPath: null,
    } as ReturnType<typeof useWorkspaceStore.getState>);

    mockTabGetState.mockReturnValue({
      tabs: {
        main: [{ id: "tab-1" }, { id: "tab-2" }],
      },
    } as unknown as ReturnType<typeof useTabStore.getState>);

    mockDocGetState.mockReturnValue({
      getDocument: vi.fn((id) => {
        if (id === "tab-1") return { filePath: null };
        if (id === "tab-2") return { filePath: "/docs/notes/file.md" };
        return null;
      }),
    } as unknown as ReturnType<typeof useDocumentStore.getState>);

    const result = await getDefaultSaveFolderWithFallback("main");

    expect(result).toBe("/docs/notes");
  });

  it("returns home directory when no workspace and no saved tabs", async () => {
    mockWorkspaceGetState.mockReturnValue({
      isWorkspaceMode: false,
      rootPath: null,
    } as ReturnType<typeof useWorkspaceStore.getState>);

    mockTabGetState.mockReturnValue({
      tabs: {
        main: [{ id: "tab-1" }],
      },
    } as unknown as ReturnType<typeof useTabStore.getState>);

    mockDocGetState.mockReturnValue({
      getDocument: vi.fn(() => ({ filePath: null })),
    } as unknown as ReturnType<typeof useDocumentStore.getState>);

    const result = await getDefaultSaveFolderWithFallback("main");

    expect(result).toBe("/Users/test");
  });

  it("returns home directory for new window with no tabs", async () => {
    mockWorkspaceGetState.mockReturnValue({
      isWorkspaceMode: false,
      rootPath: null,
    } as ReturnType<typeof useWorkspaceStore.getState>);

    mockTabGetState.mockReturnValue({
      tabs: {},
    } as unknown as ReturnType<typeof useTabStore.getState>);

    mockDocGetState.mockReturnValue({
      getDocument: vi.fn(() => null),
    } as unknown as ReturnType<typeof useDocumentStore.getState>);

    const result = await getDefaultSaveFolderWithFallback("doc-1");

    expect(result).toBe("/Users/test");
  });

  it("prefers workspace root over saved tab folder", async () => {
    mockWorkspaceGetState.mockReturnValue({
      isWorkspaceMode: true,
      rootPath: "/workspace/project",
    } as ReturnType<typeof useWorkspaceStore.getState>);

    mockTabGetState.mockReturnValue({
      tabs: {
        main: [{ id: "tab-1" }],
      },
    } as unknown as ReturnType<typeof useTabStore.getState>);

    mockDocGetState.mockReturnValue({
      getDocument: vi.fn(() => ({ filePath: "/other/path/file.md" })),
    } as unknown as ReturnType<typeof useDocumentStore.getState>);

    const result = await getDefaultSaveFolderWithFallback("main");

    // Workspace root takes precedence over saved tab folder
    expect(result).toBe("/workspace/project");
  });
});
