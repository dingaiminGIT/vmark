import { useRef, useEffect, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import type { IPty } from "tauri-pty";
import { useSettingsStore, themes } from "@/stores/settingsStore";
import { useTabStore } from "@/stores/tabStore";
import { useDocumentStore } from "@/stores/documentStore";
import { getCurrentWindowLabel } from "@/utils/workspaceStorage";
import { createFileLinkProvider } from "./fileLinkProvider";
import { createTerminalKeyHandler } from "./terminalKeyHandler";
import { spawnPty } from "./spawnPty";

import "@xterm/xterm/css/xterm.css";

/** Resolve --font-mono CSS variable to actual font family names. */
function resolveMonoFont(): string {
  const style = getComputedStyle(document.documentElement);
  const mono = style.getPropertyValue("--font-mono").trim();
  return mono || "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace";
}

/** Build xterm ITheme from the app's current theme. */
function buildXtermTheme() {
  const themeId = useSettingsStore.getState().appearance.theme;
  const colors = themes[themeId];
  return {
    background: colors.background,
    foreground: colors.foreground,
    cursor: colors.foreground,
    cursorAccent: colors.background,
    selectionBackground: colors.selection ?? "rgba(0,102,204,0.25)",
  };
}

export interface UseTerminalCallbacks {
  onSearch?: () => void;
}

/**
 * Hook managing xterm Terminal lifecycle and PTY connection.
 * The terminal instance persists across hide/show toggles because
 * TerminalPanel keeps its DOM alive (display:none when hidden).
 */
export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  callbacks?: UseTerminalCallbacks,
) {
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyRef = useRef<IPty | null>(null);
  const initializedRef = useRef(false);
  const shellExitedRef = useRef(false);

  // Fit the terminal to its container
  const fit = useCallback(() => {
    if (!fitAddonRef.current || !termRef.current) return;
    try {
      fitAddonRef.current.fit();
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
    if (!container || initializedRef.current) return;
    initializedRef.current = true;

    // Create terminal
    const term = new Terminal({
      theme: buildXtermTheme(),
      fontFamily: resolveMonoFont(),
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

    // Unicode 11 support
    const unicode11 = new Unicode11Addon();
    term.loadAddon(unicode11);
    term.unicode.activeVersion = "11";

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

    // Web links — clickable URLs open in default browser
    term.loadAddon(new WebLinksAddon((_event, uri) => {
      import("@tauri-apps/plugin-opener").then(({ openUrl }) => {
        openUrl(uri);
      });
    }));

    // File links — clickable file paths open in editor
    term.registerLinkProvider(createFileLinkProvider(term, (filePath) => {
      import("@tauri-apps/plugin-fs").then(({ readTextFile }) => {
        readTextFile(filePath).then((content) => {
          const windowLabel = getCurrentWindowLabel();
          const tabId = useTabStore.getState().createTab(windowLabel, filePath);
          useDocumentStore.getState().initDocument(tabId, content, filePath);
        }).catch(() => {
          // File not readable — ignore
        });
      });
    }));

    // Custom key handler for copy/paste/clear/search
    term.attachCustomKeyEventHandler(
      createTerminalKeyHandler(term, ptyRef, {
        onSearch: () => callbacks?.onSearch?.(),
      }),
    );

    // Initial fit (after layout settles)
    requestAnimationFrame(() => fit());

    // Track disposal so async PTY callbacks don't write to a dead terminal
    let disposed = false;

    /** Spawn a new shell and wire xterm → PTY data flow. */
    async function startShell() {
      shellExitedRef.current = false;
      try {
        const pty = await spawnPty({
          term,
          onExit: (exitCode) => {
            if (!disposed) {
              term.write(`\r\n[Process exited with code ${exitCode}]\r\n`);
              term.write("Press any key to restart...\r\n");
            }
            ptyRef.current = null;
            shellExitedRef.current = true;
          },
          disposed: () => disposed,
        });
        if (disposed) {
          try { pty.kill(); } catch { /* ignore */ }
          return;
        }
        ptyRef.current = pty;
      } catch (err) {
        if (!disposed) {
          term.write(`\r\nFailed to start shell: ${err}\r\n`);
          term.write("Press any key to retry...\r\n");
          shellExitedRef.current = true;
        }
      }
    }

    // xterm → PTY (or restart if shell exited)
    term.onData((data) => {
      if (shellExitedRef.current && !ptyRef.current) {
        shellExitedRef.current = false;
        term.clear();
        startShell();
        return;
      }
      if (ptyRef.current) {
        ptyRef.current.write(data);
      }
    });

    // Initial spawn
    startShell();

    return () => {
      disposed = true;
      if (ptyRef.current) {
        try { ptyRef.current.kill(); } catch { /* ignore */ }
        ptyRef.current = null;
      }
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      initializedRef.current = false;
    };
  }, [containerRef, fit, callbacks]);

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

  return { fit, termRef, ptyRef };
}
