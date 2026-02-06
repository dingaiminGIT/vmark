import type { IPty } from "tauri-pty";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Terminal } from "@xterm/xterm";

export interface KeyHandlerCallbacks {
  onSearch: () => void;
}

/**
 * Create a custom key event handler for the terminal.
 * Handles Cmd+C (copy/SIGINT), Cmd+V (paste), Cmd+K (clear), Cmd+F (search).
 * Returns a handler for `term.attachCustomKeyEventHandler()`.
 */
export function createTerminalKeyHandler(
  term: Terminal,
  ptyRef: React.RefObject<IPty | null>,
  callbacks: KeyHandlerCallbacks,
): (event: KeyboardEvent) => boolean {
  return (event: KeyboardEvent): boolean => {
    if (event.type !== "keydown") return true;
    const isMod = event.metaKey || event.ctrlKey;
    if (!isMod) return true;

    switch (event.key.toLowerCase()) {
      case "c": {
        if (term.hasSelection()) {
          writeText(term.getSelection());
          term.clearSelection();
          return false;
        }
        // No selection — pass through for SIGINT
        return true;
      }
      case "v": {
        readText().then((text) => {
          if (text && ptyRef.current) {
            ptyRef.current.write(text);
          }
        });
        return false;
      }
      case "k": {
        term.clear();
        return false;
      }
      case "f": {
        callbacks.onSearch();
        return false;
      }
      default:
        return true;
    }
  };
}
