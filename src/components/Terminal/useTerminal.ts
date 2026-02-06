import { useRef, useEffect, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { spawn, type IPty } from "tauri-pty";
import { useSettingsStore, themes } from "@/stores/settingsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

import "@xterm/xterm/css/xterm.css";

/** Build xterm ITheme from the app's current theme. */
function buildXtermTheme(): Record<string, string> {
  const themeId = useSettingsStore.getState().appearance.theme;
  const colors = themes[themeId];
  return {
    background: colors.background,
    foreground: colors.foreground,
    cursor: colors.foreground,
    cursorAccent: colors.background,
    selectionBackground: colors.selection ?? "rgba(0,102,204,0.25)",
    selectionForeground: undefined as unknown as string,
  };
}

/** Detect default shell on macOS/Linux. */
function getDefaultShell(): string {
  // $SHELL is always available on macOS/Linux
  return "/bin/zsh";
}

/**
 * Hook managing xterm Terminal lifecycle and PTY connection.
 * The terminal instance persists across hide/show toggles.
 */
export function useTerminal(containerRef: React.RefObject<HTMLDivElement | null>) {
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyRef = useRef<IPty | null>(null);
  const mountedRef = useRef(false);

  // Fit the terminal to its container
  const fit = useCallback(() => {
    if (!fitAddonRef.current || !termRef.current) return;
    try {
      fitAddonRef.current.fit();
      // Sync PTY dimensions
      const pty = ptyRef.current;
      const term = termRef.current;
      if (pty && term.cols > 0 && term.rows > 0) {
        pty.resize(term.cols, term.rows);
      }
    } catch {
      // Container may not be visible yet
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mountedRef.current) return;
    mountedRef.current = true;

    // Create terminal
    const term = new Terminal({
      theme: buildXtermTheme(),
      fontFamily: "var(--font-mono), monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 5000,
    });
    termRef.current = term;

    // Load fit addon
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);

    // Open terminal in container
    term.open(container);

    // Try WebGL renderer for performance
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      term.loadAddon(webglAddon);
    } catch {
      // Fallback to canvas renderer
    }

    // Initial fit
    requestAnimationFrame(() => fit());

    // Spawn PTY
    const cwd = useWorkspaceStore.getState().rootPath ?? undefined;
    try {
      const pty = spawn(getDefaultShell(), [], {
        cols: term.cols || 80,
        rows: term.rows || 24,
        cwd,
      });
      ptyRef.current = pty;

      // PTY → xterm (onData sends Uint8Array)
      pty.onData((data) => {
        term.write(data);
      });

      // PTY exit
      pty.onExit(({ exitCode }) => {
        term.write(`\r\n[Process exited with code ${exitCode}]\r\n`);
        ptyRef.current = null;
      });

      // xterm → PTY
      term.onData((data) => {
        if (ptyRef.current) {
          ptyRef.current.write(data);
        }
      });
    } catch (err) {
      term.write(`\r\nFailed to start shell: ${err}\r\n`);
    }

    return () => {
      // Kill PTY and dispose terminal on unmount
      if (ptyRef.current) {
        try { ptyRef.current.kill(); } catch { /* ignore */ }
        ptyRef.current = null;
      }
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      mountedRef.current = false;
    };
  }, [containerRef, fit]);

  // Sync theme when settings change
  useEffect(() => {
    let prevTheme = useSettingsStore.getState().appearance.theme;
    return useSettingsStore.subscribe((state) => {
      const themeId = state.appearance.theme;
      if (themeId === prevTheme) return;
      prevTheme = themeId;
      if (!termRef.current) return;
      const colors = themes[themeId];
      termRef.current.options.theme = {
        background: colors.background,
        foreground: colors.foreground,
        cursor: colors.foreground,
        cursorAccent: colors.background,
        selectionBackground: colors.selection ?? "rgba(0,102,204,0.25)",
      };
    });
  }, []);

  return { fit, termRef };
}
