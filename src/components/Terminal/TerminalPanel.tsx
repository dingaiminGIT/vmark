import { useRef, useEffect, useState, useCallback, type RefObject } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useTerminalSessions } from "./useTerminalSessions";
import { useTerminalResize } from "./useTerminalResize";
import { TerminalTabBar } from "./TerminalTabBar";
import { TerminalContextMenu } from "./TerminalContextMenu";
import { TerminalSearchBar } from "./TerminalSearchBar";
import "./terminal-panel.css";

const NULL_REF: RefObject<HTMLDivElement | null> = { current: null };

export function TerminalPanel() {
  const visible = useUIStore((s) => s.terminalVisible);
  const height = useUIStore((s) => s.terminalHeight);
  const containerRef = useRef<HTMLDivElement>(null);

  // Defer xterm init until first show
  const [activated, setActivated] = useState(false);
  useEffect(() => {
    if (visible && !activated) setActivated(true);
  }, [visible, activated]);

  // Search bar state
  const [searchVisible, setSearchVisible] = useState(false);

  const onSearch = useCallback(() => {
    setSearchVisible((v) => !v);
  }, []);

  const { fit, getActiveTerminal, getActiveSearchAddon } = useTerminalSessions(
    activated ? containerRef : NULL_REF,
    { onSearch },
  );

  // Refit when shown or resized
  useEffect(() => {
    if (!visible) return;
    requestAnimationFrame(() => fit());
  }, [visible, height, fit]);

  const handleResize = useTerminalResize(() => {
    requestAnimationFrame(() => fit());
  });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Tab bar actions
  const handleClear = useCallback(() => {
    const active = getActiveTerminal();
    if (active) active.term.clear();
  }, [getActiveTerminal]);

  const handleRestart = useCallback(() => {
    // Send SIGTERM-like reset — write exit to the PTY
    const active = getActiveTerminal();
    if (active?.pty) {
      active.pty.write("exit\n");
    }
  }, [getActiveTerminal]);

  // Not yet activated — render nothing
  if (!activated) return null;

  const active = getActiveTerminal();

  return (
    <div
      className="terminal-panel"
      style={{ height, display: visible ? "flex" : "none" }}
    >
      <div className="terminal-resize-handle" onMouseDown={handleResize} />
      <TerminalTabBar onClear={handleClear} onRestart={handleRestart} />
      <div className="terminal-sessions-container">
        <div
          ref={containerRef}
          className="terminal-container"
          onContextMenu={handleContextMenu}
        />
        {searchVisible && (
          <TerminalSearchBar
            getSearchAddon={getActiveSearchAddon}
            onClose={() => setSearchVisible(false)}
          />
        )}
      </div>
      {contextMenu && active && (
        <TerminalContextMenu
          position={contextMenu}
          term={active.term}
          ptyRef={{ current: active.pty }}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
