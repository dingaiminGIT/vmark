import { describe, it, expect, beforeEach, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore, type WorkspaceConfig } from "@/stores/workspaceStore";
import { updateWorkspaceConfig, toggleShowHiddenFiles } from "@/hooks/workspaceConfig";

function resetWorkspace() {
  useWorkspaceStore.setState({
    rootPath: null,
    config: null,
    isWorkspaceMode: false,
  });
}

describe("workspaceConfig", () => {
  beforeEach(() => {
    resetWorkspace();
    vi.clearAllMocks();
  });

  it("does nothing when workspace is not active", async () => {
    await updateWorkspaceConfig({ showHiddenFiles: true });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("persists updates when workspace is active", async () => {
    const config: WorkspaceConfig = {
      version: 1,
      excludeFolders: [".git"],
      lastOpenTabs: [],
      showHiddenFiles: false,
    };

    useWorkspaceStore.setState({
      rootPath: "/project",
      config,
      isWorkspaceMode: true,
    });

    await updateWorkspaceConfig({ showHiddenFiles: true });

    expect(invoke).toHaveBeenCalledWith("write_workspace_config", {
      rootPath: "/project",
      config: {
        ...config,
        showHiddenFiles: true,
      },
    });
    expect(useWorkspaceStore.getState().config?.showHiddenFiles).toBe(true);
  });

  it("toggles hidden files", async () => {
    const config: WorkspaceConfig = {
      version: 1,
      excludeFolders: [".git"],
      lastOpenTabs: [],
      showHiddenFiles: false,
    };

    useWorkspaceStore.setState({
      rootPath: "/project",
      config,
      isWorkspaceMode: true,
    });

    await toggleShowHiddenFiles();

    expect(invoke).toHaveBeenCalledWith("write_workspace_config", {
      rootPath: "/project",
      config: {
        ...config,
        showHiddenFiles: true,
      },
    });
  });
});
