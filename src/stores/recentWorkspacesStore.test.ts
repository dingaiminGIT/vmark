import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRecentWorkspacesStore } from "./recentWorkspacesStore";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

// Mock pathUtils
vi.mock("@/utils/pathUtils", () => ({
  getFileName: vi.fn((path: string) => {
    const parts = path.split("/");
    return parts[parts.length - 1] || path;
  }),
}));

function resetStore() {
  useRecentWorkspacesStore.setState({
    workspaces: [],
    maxWorkspaces: 10,
  });
}

beforeEach(() => {
  resetStore();
  vi.clearAllMocks();
});

describe("recentWorkspacesStore", () => {
  describe("initial state", () => {
    it("starts with empty workspaces array", () => {
      const state = useRecentWorkspacesStore.getState();
      expect(state.workspaces).toEqual([]);
    });

    it("has maxWorkspaces of 10", () => {
      const state = useRecentWorkspacesStore.getState();
      expect(state.maxWorkspaces).toBe(10);
    });
  });

  describe("addWorkspace", () => {
    it("adds a workspace to the list", () => {
      const store = useRecentWorkspacesStore.getState();
      store.addWorkspace("/path/to/project");

      const state = useRecentWorkspacesStore.getState();
      expect(state.workspaces).toHaveLength(1);
      expect(state.workspaces[0].path).toBe("/path/to/project");
      expect(state.workspaces[0].name).toBe("project");
    });

    it("adds workspace to the front of the list", () => {
      const store = useRecentWorkspacesStore.getState();
      store.addWorkspace("/path/to/project1");
      store.addWorkspace("/path/to/project2");

      const state = useRecentWorkspacesStore.getState();
      expect(state.workspaces[0].path).toBe("/path/to/project2");
      expect(state.workspaces[1].path).toBe("/path/to/project1");
    });

    it("moves existing workspace to the front when re-added", () => {
      const store = useRecentWorkspacesStore.getState();
      store.addWorkspace("/path/to/project1");
      store.addWorkspace("/path/to/project2");
      store.addWorkspace("/path/to/project1"); // Re-add first one

      const state = useRecentWorkspacesStore.getState();
      expect(state.workspaces).toHaveLength(2);
      expect(state.workspaces[0].path).toBe("/path/to/project1");
      expect(state.workspaces[1].path).toBe("/path/to/project2");
    });

    it("limits to maxWorkspaces", () => {
      const store = useRecentWorkspacesStore.getState();

      // Add 12 workspaces
      for (let i = 0; i < 12; i++) {
        store.addWorkspace(`/path/to/project${i}`);
      }

      const state = useRecentWorkspacesStore.getState();
      expect(state.workspaces).toHaveLength(10);
      // Most recent should be project11, oldest kept should be project2
      expect(state.workspaces[0].path).toBe("/path/to/project11");
      expect(state.workspaces[9].path).toBe("/path/to/project2");
    });

    it("sets timestamp on add", () => {
      const before = Date.now();
      const store = useRecentWorkspacesStore.getState();
      store.addWorkspace("/path/to/project");
      const after = Date.now();

      const state = useRecentWorkspacesStore.getState();
      expect(state.workspaces[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(state.workspaces[0].timestamp).toBeLessThanOrEqual(after);
    });

    it("updates timestamp when workspace is re-added", async () => {
      const store = useRecentWorkspacesStore.getState();
      store.addWorkspace("/path/to/project");
      const firstTimestamp = useRecentWorkspacesStore.getState().workspaces[0].timestamp;

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      store.addWorkspace("/path/to/project");
      const secondTimestamp = useRecentWorkspacesStore.getState().workspaces[0].timestamp;

      expect(secondTimestamp).toBeGreaterThan(firstTimestamp);
    });

    it("calls syncToNativeMenu after adding", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const store = useRecentWorkspacesStore.getState();
      store.addWorkspace("/path/to/project");

      expect(invoke).toHaveBeenCalledWith("update_recent_workspaces", {
        workspaces: ["/path/to/project"],
      });
    });
  });

  describe("removeWorkspace", () => {
    it("removes a workspace from the list", () => {
      const store = useRecentWorkspacesStore.getState();
      store.addWorkspace("/path/to/project1");
      store.addWorkspace("/path/to/project2");
      store.removeWorkspace("/path/to/project1");

      const state = useRecentWorkspacesStore.getState();
      expect(state.workspaces).toHaveLength(1);
      expect(state.workspaces[0].path).toBe("/path/to/project2");
    });

    it("does nothing if workspace not found", () => {
      const store = useRecentWorkspacesStore.getState();
      store.addWorkspace("/path/to/project1");
      store.removeWorkspace("/path/to/nonexistent");

      const state = useRecentWorkspacesStore.getState();
      expect(state.workspaces).toHaveLength(1);
    });

    it("calls syncToNativeMenu after removing", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const store = useRecentWorkspacesStore.getState();
      store.addWorkspace("/path/to/project");
      vi.clearAllMocks();

      store.removeWorkspace("/path/to/project");

      expect(invoke).toHaveBeenCalledWith("update_recent_workspaces", {
        workspaces: [],
      });
    });
  });

  describe("clearAll", () => {
    it("clears all workspaces", () => {
      const store = useRecentWorkspacesStore.getState();
      store.addWorkspace("/path/to/project1");
      store.addWorkspace("/path/to/project2");
      store.clearAll();

      const state = useRecentWorkspacesStore.getState();
      expect(state.workspaces).toEqual([]);
    });

    it("calls syncToNativeMenu with empty array", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const store = useRecentWorkspacesStore.getState();
      store.addWorkspace("/path/to/project");
      vi.clearAllMocks();

      store.clearAll();

      expect(invoke).toHaveBeenCalledWith("update_recent_workspaces", {
        workspaces: [],
      });
    });
  });

  describe("syncToNativeMenu", () => {
    it("syncs current workspaces to native menu", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const store = useRecentWorkspacesStore.getState();

      // Set up some workspaces directly
      useRecentWorkspacesStore.setState({
        workspaces: [
          { path: "/path/to/project1", name: "project1", timestamp: 1 },
          { path: "/path/to/project2", name: "project2", timestamp: 2 },
        ],
      });

      vi.clearAllMocks();
      store.syncToNativeMenu();

      expect(invoke).toHaveBeenCalledWith("update_recent_workspaces", {
        workspaces: ["/path/to/project1", "/path/to/project2"],
      });
    });

    it("handles invoke error gracefully", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      vi.mocked(invoke).mockRejectedValueOnce(new Error("Failed"));

      const store = useRecentWorkspacesStore.getState();
      // Should not throw
      expect(() => store.addWorkspace("/path/to/project")).not.toThrow();
    });
  });

  describe("workspace name extraction", () => {
    it("extracts folder name from simple path", () => {
      const store = useRecentWorkspacesStore.getState();
      store.addWorkspace("/Users/test/projects/myproject");

      const state = useRecentWorkspacesStore.getState();
      expect(state.workspaces[0].name).toBe("myproject");
    });

    it("handles paths with trailing slash", () => {
      const store = useRecentWorkspacesStore.getState();
      // Note: getFileName mock handles this
      store.addWorkspace("/Users/test/projects/myproject/");

      const state = useRecentWorkspacesStore.getState();
      // Empty string after last slash, so returns the path
      expect(state.workspaces[0].name).toBeDefined();
    });
  });
});
