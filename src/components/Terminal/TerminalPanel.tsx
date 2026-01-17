import { useTerminalStore } from "@/stores/terminalStore";
import { useTerminalResize } from "@/hooks/useTerminalResize";
import { TerminalView } from "./TerminalView";
import "./TerminalPanel.css";

export function TerminalPanel() {
  const visible = useTerminalStore((state) => state.visible);
  const height = useTerminalStore((state) => state.height);
  const handleResizeStart = useTerminalResize();

  if (!visible) return null;

  return (
    <div className="terminal-panel" style={{ height }}>
      {/* Resize handle at the top */}
      <div className="terminal-resize-handle" onMouseDown={handleResizeStart} />
      {/* Terminal content */}
      <div className="terminal-content">
        <TerminalView />
      </div>
    </div>
  );
}
