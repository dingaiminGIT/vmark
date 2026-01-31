/**
 * Advanced Settings Section
 *
 * Developer and system configuration.
 */

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { SettingRow, SettingsGroup, Toggle, TagInput } from "./components";
import { useSettingsStore } from "@/stores/settingsStore";
import { restartWithHotExit } from "@/utils/hotExit/restartWithHotExit";
import type { SessionData } from "@/utils/hotExit/types";

export function AdvancedSettings() {
  const [devTools, setDevTools] = useState(false);
  const [hardwareAccel, setHardwareAccel] = useState(true);
  const customLinkProtocols = useSettingsStore((state) => state.advanced.customLinkProtocols);
  const updateAdvancedSetting = useSettingsStore((state) => state.updateAdvancedSetting);

  return (
    <div>
      <SettingsGroup title="System">
        <SettingRow label="Developer tools" description="Enable developer mode">
          <Toggle checked={devTools} onChange={setDevTools} />
        </SettingRow>
        <SettingRow
          label="Hardware acceleration"
          description="Use GPU for rendering"
        >
          <Toggle checked={hardwareAccel} onChange={setHardwareAccel} />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Link Protocols">
        <div className="py-2.5">
          <div className="text-sm font-medium text-[var(--text-primary)] mb-1">
            Custom link protocols
          </div>
          <div className="text-xs text-[var(--text-tertiary)] mb-2">
            Additional URL protocols to recognize when inserting links (e.g., obsidian, vscode)
          </div>
          <TagInput
            value={customLinkProtocols ?? []}
            onChange={(v) => updateAdvancedSetting("customLinkProtocols", v)}
            placeholder="Add protocol..."
          />
        </div>
      </SettingsGroup>

      {/* Hot Exit Dev Tools - only visible when developer mode is enabled */}
      {devTools && (
        <SettingsGroup title="Hot Exit Dev Tools">
          <div className="py-2.5 space-y-3">
            <div className="text-sm text-[var(--text-secondary)] mb-3">
              Test hot exit session capture and restore without actual updates.
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  try {
                    const session: SessionData = await invoke("hot_exit_test_capture");
                    toast.success(`Captured ${session.windows.length} window(s)`, {
                      description: `Version ${session.vmark_version}`,
                    });
                  } catch (error) {
                    toast.error("Capture failed", {
                      description: error instanceof Error ? error.message : String(error),
                    });
                  }
                }}
                className="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--hover-bg)] rounded border border-[var(--border-color)] transition-colors"
              >
                Test Capture
              </button>

              <button
                onClick={async () => {
                  try {
                    const session: SessionData | null = await invoke("hot_exit_inspect_session");
                    if (!session) {
                      toast.info("No saved session found");
                      return;
                    }
                    const age = Math.floor((Date.now() - session.timestamp * 1000) / 1000);
                    toast.info(`Session found (${age}s ago)`, {
                      description: `${session.windows.length} windows, v${session.vmark_version}`,
                    });
                  } catch (error) {
                    toast.error("Inspect failed", {
                      description: error instanceof Error ? error.message : String(error),
                    });
                  }
                }}
                className="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--hover-bg)] rounded border border-[var(--border-color)] transition-colors"
              >
                Inspect Session
              </button>

              <button
                onClick={async () => {
                  try {
                    const session: SessionData | null = await invoke("hot_exit_inspect_session");
                    if (!session) {
                      toast.info("No saved session to restore");
                      return;
                    }
                    await invoke("hot_exit_test_restore", { session });
                    toast.success("Session restored successfully");
                  } catch (error) {
                    toast.error("Restore failed", {
                      description: error instanceof Error ? error.message : String(error),
                    });
                  }
                }}
                className="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--hover-bg)] rounded border border-[var(--border-color)] transition-colors"
              >
                Test Restore
              </button>

              <button
                onClick={async () => {
                  try {
                    await invoke("hot_exit_clear_session");
                    toast.success("Session cleared");
                  } catch (error) {
                    toast.error("Clear failed", {
                      description: error instanceof Error ? error.message : String(error),
                    });
                  }
                }}
                className="px-3 py-1.5 text-sm bg-[var(--error-bg)] hover:bg-[var(--error-color)] hover:text-[var(--contrast-text)] text-[var(--error-color)] rounded border border-[var(--error-color)] transition-colors"
              >
                Clear Session
              </button>

              <button
                onClick={async () => {
                  try {
                    await restartWithHotExit();
                  } catch (error) {
                    toast.error("Restart failed", {
                      description: error instanceof Error ? error.message : String(error),
                    });
                  }
                }}
                className="px-3 py-1.5 text-sm bg-[var(--primary-color)] hover:opacity-90 text-[var(--contrast-text)] rounded border border-[var(--primary-color)] transition-opacity"
              >
                Test Restart
              </button>
            </div>
          </div>
        </SettingsGroup>
      )}
    </div>
  );
}
