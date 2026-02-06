import { useState, useCallback, useRef, useEffect } from "react";
import { Plus, X, Trash2, RotateCcw } from "lucide-react";
import { useTerminalSessionStore } from "@/stores/terminalSessionStore";
import "./TerminalTabBar.css";

interface TerminalTabBarProps {
  onClear: () => void;
  onRestart: () => void;
}

export function TerminalTabBar({ onClear, onRestart }: TerminalTabBarProps) {
  const sessions = useTerminalSessionStore((s) => s.sessions);
  const activeId = useTerminalSessionStore((s) => s.activeSessionId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCreate = useCallback(() => {
    useTerminalSessionStore.getState().createSession();
  }, []);

  const handleSwitch = useCallback((id: string) => {
    useTerminalSessionStore.getState().setActiveSession(id);
  }, []);

  const handleClose = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      useTerminalSessionStore.getState().removeSession(id);
    },
    [],
  );

  const handleDoubleClick = useCallback((id: string, label: string) => {
    setEditingId(id);
    setEditValue(label);
  }, []);

  const commitRename = useCallback(() => {
    if (editingId && editValue.trim()) {
      useTerminalSessionStore.getState().renameSession(editingId, editValue.trim());
    }
    setEditingId(null);
  }, [editingId, editValue]);

  // Focus input when editing
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const isMaxed = sessions.length >= 5;

  return (
    <div className="terminal-tab-bar">
      <div className="terminal-tab-bar-tabs">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`terminal-tab ${s.id === activeId ? "terminal-tab-active" : ""}`}
            onClick={() => handleSwitch(s.id)}
            onDoubleClick={() => handleDoubleClick(s.id, s.label)}
          >
            {editingId === s.id ? (
              <input
                ref={inputRef}
                className="terminal-tab-rename-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingId(null);
                }}
              />
            ) : (
              <span className="terminal-tab-label">{s.label}</span>
            )}
            {sessions.length > 1 && (
              <button
                className="terminal-tab-close"
                onClick={(e) => handleClose(e, s.id)}
                title="Close"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}

        <button
          className="terminal-tab-bar-btn"
          onClick={handleCreate}
          disabled={isMaxed}
          title={isMaxed ? "Maximum 5 sessions" : "New Terminal"}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="terminal-tab-bar-actions">
        <button className="terminal-tab-bar-btn" onClick={onClear} title="Clear">
          <Trash2 size={14} />
        </button>
        <button className="terminal-tab-bar-btn" onClick={onRestart} title="Restart">
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}
