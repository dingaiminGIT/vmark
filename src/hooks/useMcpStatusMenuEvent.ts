/**
 * MCP Status Menu Event Hook
 *
 * Handles the Help → MCP Server Status menu event.
 * Opens Settings window and navigates to the Integrations section.
 */

import { useEffect, useRef } from "react";
import { type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { openSettingsWindow } from "@/utils/settingsWindow";

/**
 * Hook to handle the MCP Server Status menu event.
 * Opens Settings → Integrations section.
 */
export function useMcpStatusMenuEvent() {
  const unlistenRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      // Clean up existing listener
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }

      if (cancelled) return;

      const currentWindow = getCurrentWebviewWindow();
      const windowLabel = currentWindow.label;

      // Listen for MCP status menu event
      unlistenRef.current = await currentWindow.listen<string>(
        "menu:mcp-status",
        async (event) => {
          if (event.payload !== windowLabel) return;
          await openSettingsWindow("integrations");
        }
      );
    };

    setup();

    return () => {
      cancelled = true;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);
}
