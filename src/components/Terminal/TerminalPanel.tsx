import { useRef, useEffect } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useTerminal } from "./useTerminal";
import { useTerminalResize } from "./useTerminalResize";
import "./terminal-panel.css";

export function TerminalPanel() {
  const visible = useUIStore((s) => s.terminalVisible);
  const height = useUIStore((s) => s.terminalHeight);
  const containerRef = useRef<HTMLDivElement>(null);

  // Only mount xterm once visible for the first time
  const hasBeenVisible = useRef(false);
  if (visible) hasBeenVisible.current = true;

  const { fit } = useTerminal(hasBeenVisible.current ? containerRef : { current: null });

  // Refit on height change
  useEffect(() => {
    if (!visible) return;
    requestAnimationFrame(() => fit());
  }, [visible, height, fit]);

  const handleResize = useTerminalResize(() => {
    requestAnimationFrame(() => fit());
  });

  if (!visible) return null;

  return (
    <div className="terminal-panel" style={{ height }}>
      <div className="terminal-resize-handle" onMouseDown={handleResize} />
      <div ref={containerRef} className="terminal-container" />
    </div>
  );
}
