import { spawn, type IPty } from "tauri-pty";
import { invoke } from "@tauri-apps/api/core";
import type { Terminal } from "@xterm/xterm";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useTabStore } from "@/stores/tabStore";
import { useDocumentStore } from "@/stores/documentStore";
import { getCurrentWindowLabel } from "@/utils/workspaceStorage";

/**
 * Resolve terminal working directory:
 * 1. Workspace root (if open)
 * 2. Active file's parent directory (if saved)
 * 3. undefined — lets the shell start in its default ($HOME)
 */
export function resolveTerminalCwd(): string | undefined {
  const workspaceRoot = useWorkspaceStore.getState().rootPath;
  if (workspaceRoot) return workspaceRoot;

  const windowLabel = getCurrentWindowLabel();
  const activeTabId = useTabStore.getState().activeTabId[windowLabel];
  if (activeTabId) {
    const doc = useDocumentStore.getState().getDocument(activeTabId);
    if (doc?.filePath) {
      const lastSlash = doc.filePath.lastIndexOf("/");
      if (lastSlash > 0) return doc.filePath.substring(0, lastSlash);
    }
  }

  return undefined;
}

export interface SpawnOptions {
  term: Terminal;
  onExit: (exitCode: number) => void;
  disposed: () => boolean;
}

/**
 * Spawn a PTY process connected to the terminal.
 * Reads shell from Tauri backend, resolves cwd, wires data streams.
 */
export async function spawnPty(options: SpawnOptions): Promise<IPty> {
  const { term, onExit, disposed } = options;

  const shell = await invoke<string>("get_default_shell");
  if (disposed()) throw new Error("disposed before spawn");

  const cwd = resolveTerminalCwd();
  const workspaceRoot = useWorkspaceStore.getState().rootPath;

  const env: Record<string, string> = {
    TERM_PROGRAM: "vmark",
    EDITOR: "vmark",
  };
  if (workspaceRoot) {
    env.VMARK_WORKSPACE = workspaceRoot;
  }

  const pty = spawn(shell, [], {
    cols: term.cols || 80,
    rows: term.rows || 24,
    cwd,
    env,
  });

  // PTY → xterm
  pty.onData((data) => {
    if (!disposed()) term.write(data);
  });

  // PTY exit
  pty.onExit(({ exitCode }) => {
    onExit(exitCode);
  });

  return pty;
}
