import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveTerminalCwd } from "./spawnPty";

// Mock stores
vi.mock("@/stores/workspaceStore", () => ({
  useWorkspaceStore: { getState: vi.fn(() => ({ rootPath: null })) },
}));

vi.mock("@/stores/tabStore", () => ({
  useTabStore: { getState: vi.fn(() => ({ activeTabId: {} })) },
}));

vi.mock("@/stores/documentStore", () => ({
  useDocumentStore: { getState: vi.fn(() => ({ getDocument: () => null })) },
}));

vi.mock("@/utils/workspaceStorage", () => ({
  getCurrentWindowLabel: vi.fn(() => "main"),
}));

vi.mock("tauri-pty", () => ({
  spawn: vi.fn(() => ({
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  })),
}));

import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useTabStore } from "@/stores/tabStore";
import { useDocumentStore } from "@/stores/documentStore";

describe("resolveTerminalCwd", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns workspace root when available", () => {
    vi.mocked(useWorkspaceStore.getState).mockReturnValue({
      rootPath: "/workspace/root",
    } as ReturnType<typeof useWorkspaceStore.getState>);

    expect(resolveTerminalCwd()).toBe("/workspace/root");
  });

  it("returns active file parent dir when no workspace", () => {
    vi.mocked(useWorkspaceStore.getState).mockReturnValue({
      rootPath: null,
    } as ReturnType<typeof useWorkspaceStore.getState>);
    vi.mocked(useTabStore.getState).mockReturnValue({
      activeTabId: { main: "tab1" },
    } as unknown as ReturnType<typeof useTabStore.getState>);
    vi.mocked(useDocumentStore.getState).mockReturnValue({
      getDocument: () => ({ filePath: "/Users/test/docs/file.md" }),
    } as unknown as ReturnType<typeof useDocumentStore.getState>);

    expect(resolveTerminalCwd()).toBe("/Users/test/docs");
  });

  it("returns undefined when no workspace and no active file", () => {
    vi.mocked(useWorkspaceStore.getState).mockReturnValue({
      rootPath: null,
    } as ReturnType<typeof useWorkspaceStore.getState>);
    vi.mocked(useTabStore.getState).mockReturnValue({
      activeTabId: {},
    } as unknown as ReturnType<typeof useTabStore.getState>);

    expect(resolveTerminalCwd()).toBeUndefined();
  });

  it("returns undefined when active file has no path", () => {
    vi.mocked(useWorkspaceStore.getState).mockReturnValue({
      rootPath: null,
    } as ReturnType<typeof useWorkspaceStore.getState>);
    vi.mocked(useTabStore.getState).mockReturnValue({
      activeTabId: { main: "tab1" },
    } as unknown as ReturnType<typeof useTabStore.getState>);
    vi.mocked(useDocumentStore.getState).mockReturnValue({
      getDocument: () => ({ filePath: null }),
    } as unknown as ReturnType<typeof useDocumentStore.getState>);

    expect(resolveTerminalCwd()).toBeUndefined();
  });
});
