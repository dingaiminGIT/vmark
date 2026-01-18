import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X } from "lucide-react";
import {
  useTerminalStore,
  type TerminalSession,
} from "@/stores/terminalStore";
import { useSettingsStore, type ThemeId } from "@/stores/settingsStore";
import { useTerminalResize } from "@/hooks/useTerminalResize";
import { TerminalView } from "./TerminalView";
import { TerminalTabs } from "./TerminalTabs";
import "./TerminalPanel.css";

/**
 * Chrome colors for terminal panel.
 * These match the terminal content themes for visual consistency.
 */
interface TerminalChromeColors {
  bg: string;
  border: string;
  text: string;
  textActive: string;
  hoverBg: string;
  activeBg: string;
}

const chromeThemes: Record<ThemeId, TerminalChromeColors> = {
  white: {
    bg: "#f3f3f3",
    border: "#e0e0e0",
    text: "#666666",
    textActive: "#1a1a1a",
    hoverBg: "#e8e8e8",
    activeBg: "#ffffff",
  },
  paper: {
    bg: "#e6e5e5",
    border: "#d5d4d4",
    text: "#666666",
    textActive: "#1a1a1a",
    hoverBg: "#dcdcdc",
    activeBg: "#EEEDED",
  },
  mint: {
    bg: "#b8d9bd",
    border: "#a3c9a8",
    text: "#4a5f52",
    textActive: "#2d3a35",
    hoverBg: "#a8cead",
    activeBg: "#CCE6D0",
  },
  sepia: {
    bg: "#efe5ce",
    border: "#e0d4b8",
    text: "#8b7355",
    textActive: "#5c4b37",
    hoverBg: "#e6d9be",
    activeBg: "#F9F0DB",
  },
  night: {
    bg: "#252526",
    border: "#3c3c3c",
    text: "#808080",
    textActive: "#d6d9de",
    hoverBg: "#2a2d2e",
    activeBg: "#23262b",
  },
};

/** Get terminal chrome colors based on settings */
function useTerminalChromeColors(): TerminalChromeColors {
  const terminalThemeSetting = useSettingsStore((state) => state.terminal.theme);
  const appTheme = useSettingsStore((state) => state.appearance.theme);

  return useMemo(() => {
    if (terminalThemeSetting === "dark") return chromeThemes.night;
    if (terminalThemeSetting === "light") {
      return appTheme === "night" ? chromeThemes.white : chromeThemes[appTheme];
    }
    return chromeThemes[appTheme] ?? chromeThemes.paper;
  }, [terminalThemeSetting, appTheme]);
}

/** Represents a mounted terminal */
interface MountedTerminal {
  key: string;
  sessionToRestore?: TerminalSession;
}

export function TerminalPanel() {
  const visible = useTerminalStore((state) => state.visible);
  const height = useTerminalStore((state) => state.height);
  const width = useTerminalStore((state) => state.width);
  const sessions = useTerminalStore((state) => state.sessions);
  const removeSession = useTerminalStore((state) => state.removeSession);
  const getSessionsToRestore = useTerminalStore((state) => state.getSessionsToRestore);
  const splitSession = useTerminalStore((state) => state.splitSession);
  const position = useSettingsStore((state) => state.terminal.position);
  const handleResizeStart = useTerminalResize();
  const chromeColors = useTerminalChromeColors();

  const [mountedTerminals, setMountedTerminals] = useState<MountedTerminal[]>([]);

  // Create the first terminal session
  const handleNewSession = useCallback(() => {
    const key = `term-${Date.now()}`;
    setMountedTerminals((prev) => [...prev, { key }]);
  }, []);

  // Split: direction based on position (bottom=horizontal, right=vertical)
  const handleSplit = useCallback(() => {
    const primarySession = sessions[0];
    if (!primarySession || sessions.length >= 2) return;

    const direction = position === "bottom" ? "horizontal" : "vertical";
    const tempId = `split-${Date.now()}`;
    splitSession(primarySession.id, tempId, direction);
    setMountedTerminals((prev) => [...prev, { key: `split-${tempId}` }]);
  }, [sessions, position, splitSession]);

  // Close a session (and its PTY)
  const handleCloseSession = useCallback(
    async (sessionId: string) => {
      try {
        await invoke("pty_kill", { sessionId });
      } catch {
        // Session may already be dead
      }
      removeSession(sessionId);
    },
    [removeSession]
  );

  // Initialize on first visible
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (visible && mountedTerminals.length === 0 && !hasInitialized.current) {
      hasInitialized.current = true;

      const sessionsToRestore = getSessionsToRestore();
      if (sessionsToRestore.length > 0) {
        const restoredTerminals: MountedTerminal[] = sessionsToRestore.map((session, index) => ({
          key: `restore-${session.id}-${index}`,
          sessionToRestore: session,
        }));
        setMountedTerminals(restoredTerminals);
      } else {
        handleNewSession();
      }
    }
  }, [visible, mountedTerminals.length, handleNewSession, getSessionsToRestore]);

  // Clean up mounted terminals when sessions are removed
  useEffect(() => {
    const activeSessionCount = sessions.filter((s) => !s.needsRestore).length;
    if (mountedTerminals.length > 0 && activeSessionCount > 0 && activeSessionCount < mountedTerminals.length) {
      setMountedTerminals((prev) => prev.slice(0, activeSessionCount || 1));
    }
  }, [sessions, mountedTerminals.length]);

  // Reset when hidden
  useEffect(() => {
    if (!visible) {
      hasInitialized.current = false;
    }
  }, [visible]);

  if (!visible) return null;

  const isRightPosition = position === "right";
  const isSplit = sessions.length >= 2;

  // Split direction: bottom=horizontal (side by side), right=vertical (top/bottom)
  const splitDirection = position === "bottom" ? "horizontal" : "vertical";

  const panelStyle: React.CSSProperties & Record<`--${string}`, string> = {
    ...(isRightPosition ? { width, height: "100%" } : { height, width: "100%" }),
    "--terminal-chrome-bg": chromeColors.bg,
    "--terminal-chrome-border": chromeColors.border,
    "--terminal-chrome-text": chromeColors.text,
    "--terminal-chrome-text-active": chromeColors.textActive,
    "--terminal-chrome-hover-bg": chromeColors.hoverBg,
    "--terminal-chrome-active-bg": chromeColors.activeBg,
  };

  const panelClassName = `terminal-panel terminal-panel--${position}`;

  return (
    <div className={panelClassName} style={panelStyle}>
      {/* Resize handle */}
      <div
        className={`terminal-resize-handle terminal-resize-handle--${position}`}
        onMouseDown={handleResizeStart}
      />

      {/* Terminal content */}
      <div className="terminal-content">
        {isSplit ? (
          // Split view: two panes with close buttons
          <div className={`terminal-split terminal-split--${splitDirection}`}>
            {mountedTerminals.map((mounted, index) => {
              const session = sessions[index];
              if (!session) return null;

              return (
                <div key={mounted.key} className="terminal-split-pane">
                  <div className="terminal-session">
                    <TerminalView sessionToRestore={mounted.sessionToRestore} />
                  </div>
                  {/* Close button for this pane */}
                  <button
                    className="terminal-pane-close"
                    onClick={() => handleCloseSession(session.id)}
                    title="Close this pane"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          // Single terminal view
          mountedTerminals.map((mounted) => (
            <div key={mounted.key} className="terminal-session">
              <TerminalView sessionToRestore={mounted.sessionToRestore} />
            </div>
          ))
        )}
      </div>

      {/* Bottom bar with split button (hidden when split) */}
      {sessions.length > 0 && (
        <TerminalTabs onSplit={handleSplit} />
      )}
    </div>
  );
}
