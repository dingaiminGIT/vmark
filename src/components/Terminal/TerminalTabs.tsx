/**
 * Terminal Bar Component
 *
 * Simple bar with split button. No tabs - just one terminal (or two when split).
 * Split button hidden when already split.
 */

import { Columns2, Rows2 } from "lucide-react";
import { useTerminalStore } from "@/stores/terminalStore";
import { useSettingsStore } from "@/stores/settingsStore";
import "./TerminalTabs.css";

interface TerminalTabsProps {
  onSplit: () => void;
}

export function TerminalTabs({ onSplit }: TerminalTabsProps) {
  const sessions = useTerminalStore((state) => state.sessions);
  const position = useSettingsStore((state) => state.terminal.position);

  // Check if already split (2 sessions means split)
  const isSplit = sessions.length >= 2;

  // Don't show anything if already split
  if (isSplit) return null;

  // Split direction based on position: bottom=horizontal (side by side), right=vertical (top/bottom)
  const SplitIcon = position === "bottom" ? Columns2 : Rows2;
  const splitTitle = position === "bottom" ? "Split horizontal" : "Split vertical";

  return (
    <div className="terminal-tabs">
      <div className="terminal-tabs-list" />
      <div className="terminal-tabs-actions">
        <button
          className="terminal-tab-action"
          onClick={onSplit}
          title={splitTitle}
        >
          <SplitIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
