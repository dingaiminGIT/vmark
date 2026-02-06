import { useCallback } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { useTerminalSessionStore } from "@/stores/terminalSessionStore";
import "./TerminalTabBar.css";

interface TerminalTabBarProps {
  onClose: () => void;
  onRestart: () => void;
}

/** Extract display number from "Terminal N" labels, or first char for custom names. */
function getTabDisplay(label: string): string {
  const m = label.match(/^Terminal (\d+)$/);
  return m ? m[1] : label.charAt(0).toUpperCase();
}

export function TerminalTabBar({ onClose, onRestart }: TerminalTabBarProps) {
  const sessions = useTerminalSessionStore((s) => s.sessions);
  const activeId = useTerminalSessionStore((s) => s.activeSessionId);

  const handleCreate = useCallback(() => {
    useTerminalSessionStore.getState().createSession();
  }, []);

  const handleSwitch = useCallback((id: string) => {
    useTerminalSessionStore.getState().setActiveSession(id);
  }, []);

  const isMaxed = sessions.length >= 5;

  return (
    <div className="terminal-tab-bar">
      <div className="terminal-tab-bar-tabs">
        {sessions.map((s) => (
          <button
            key={s.id}
            className={`terminal-tab ${s.id === activeId ? "terminal-tab-active" : ""} ${!s.isAlive ? "terminal-tab-dead" : ""}`}
            onClick={() => handleSwitch(s.id)}
            title={s.label}
          >
            {getTabDisplay(s.label)}
          </button>
        ))}

        <button
          className="terminal-tab-bar-btn"
          onClick={handleCreate}
          disabled={isMaxed}
          title={isMaxed ? "Maximum 5 sessions" : "New Terminal"}
        >
          <Plus size={12} />
        </button>
      </div>

      <div className="terminal-tab-bar-actions">
        <button className="terminal-tab-bar-btn" onClick={onClose} title="Close">
          <Trash2 size={12} />
        </button>
        <button className="terminal-tab-bar-btn" onClick={onRestart} title="Restart">
          <RotateCcw size={12} />
        </button>
      </div>
    </div>
  );
}
