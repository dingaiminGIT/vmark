import { useRef, useEffect, useState, useCallback, type RefObject } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useTerminalSessionStore } from "@/stores/terminalSessionStore";
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

  const { fit, getActiveTerminal, getActiveSearchAddon, restartActiveSession } =
    useTerminalSessions(activated ? containerRef : NULL_REF, { onSearch });

  // Create a session when terminal becomes visible with none existing
  // (e.g., user closed all tabs then re-opened the panel)
  useEffect(() => {
    if (!visible) return;
    const store = useTerminalSessionStore.getState();
    if (store.sessions.length === 0) {
      store.createSession();
    }
  }, [visible]);

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
  const handleClose = useCallback(() => {
    const store = useTerminalSessionStore.getState();
    if (!store.activeSessionId) return;

    const isLast = store.sessions.length <= 1;
    store.removeSession(store.activeSessionId);

    // Last session — also hide the panel
    if (isLast) {
      useUIStore.getState().toggleTerminal();
    }
  }, []);

  const handleRestart = useCallback(() => {
    restartActiveSession();
  }, [restartActiveSession]);

  // Not yet activated — render nothing
  if (!activated) return null;

  const active = getActiveTerminal();

  return (
    <div
      className="terminal-panel"
      style={{ height, display: visible ? "flex" : "none" }}
    >
      <div className="terminal-resize-handle" onMouseDown={handleResize} />
      <div className="terminal-body">
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
        <TerminalTabBar onClose={handleClose} onRestart={handleRestart} />
      </div>
      {contextMenu && active && (
        <TerminalContextMenu
          position={contextMenu}
          term={active.term}
          ptyRef={active.ptyRef}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
