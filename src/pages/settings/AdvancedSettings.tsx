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

/**
 * Helper to wrap async operations with error handling
 */
async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorMessage: string
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    toast.error(errorMessage, {
      description: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function AdvancedSettings() {
  const [devTools, setDevTools] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const customLinkProtocols = useSettingsStore((state) => state.advanced.customLinkProtocols);
  const keepBothEditorsAlive = useSettingsStore((state) => state.advanced.keepBothEditorsAlive);
  const updateAdvancedSetting = useSettingsStore((state) => state.updateAdvancedSetting);

  return (
    <div>
      <SettingsGroup title="Developer">
        <SettingRow label="Developer tools" description="Enable developer mode and show dev tools below">
          <Toggle checked={devTools} onChange={setDevTools} />
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

      <SettingsGroup title="Performance">
        <SettingRow
          label="Keep both editors alive"
          description="Faster mode switching at the cost of higher memory usage"
        >
          <Toggle
            checked={keepBothEditorsAlive}
            onChange={(v) => updateAdvancedSetting("keepBothEditorsAlive", v)}
          />
        </SettingRow>
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
                  if (isBusy) return;
                  setIsBusy(true);
                  const session = await withErrorHandling(
                    () => invoke<SessionData>("hot_exit_capture"),
                    "Capture failed"
                  );
                  if (session) {
                    toast.success(`Captured ${session.windows.length} window(s)`, {
                      description: `v${session.vmark_version}`,
                    });
                  }
                  setIsBusy(false);
                }}
                disabled={isBusy}
                className="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed rounded border border-[var(--border-color)] transition-colors"
              >
                Test Capture
              </button>

              <button
                onClick={async () => {
                  if (isBusy) return;
                  setIsBusy(true);
                  const session = await withErrorHandling(
                    () => invoke<SessionData | null>("hot_exit_inspect_session"),
                    "Inspect failed"
                  );
                  if (session) {
                    const age = Math.max(0, Math.floor((Date.now() - session.timestamp * 1000) / 1000));
                    toast.info(`Session found (${age}s ago)`, {
                      description: `${session.windows.length} windows, v${session.vmark_version}`,
                    });
                  } else if (session === null) {
                    toast.info("No saved session found");
                  }
                  setIsBusy(false);
                }}
                disabled={isBusy}
                className="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed rounded border border-[var(--border-color)] transition-colors"
              >
                Inspect Session
              </button>

              <button
                onClick={async () => {
                  if (isBusy) return;
                  setIsBusy(true);
                  const session = await withErrorHandling(
                    () => invoke<SessionData | null>("hot_exit_inspect_session"),
                    "Restore failed"
                  );
                  if (session) {
                    const result = await withErrorHandling(
                      () => invoke<void>("hot_exit_restore", { session }),
                      "Restore failed"
                    );
                    if (result !== null) {
                      toast.success("Session restored successfully");
                    }
                  } else if (session === null) {
                    toast.info("No saved session to restore");
                  }
                  setIsBusy(false);
                }}
                disabled={isBusy}
                className="px-3 py-1.5 text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--hover-bg)] disabled:opacity-50 disabled:cursor-not-allowed rounded border border-[var(--border-color)] transition-colors"
              >
                Test Restore
              </button>

              <button
                onClick={async () => {
                  if (isBusy) return;
                  setIsBusy(true);
                  const result = await withErrorHandling(
                    () => invoke<void>("hot_exit_clear_session"),
                    "Clear failed"
                  );
                  if (result !== null) {
                    toast.success("Session cleared");
                  }
                  setIsBusy(false);
                }}
                disabled={isBusy}
                className="px-3 py-1.5 text-sm bg-[var(--error-bg)] hover:bg-[var(--error-color)] hover:text-[var(--contrast-text)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--error-color)] rounded border border-[var(--error-color)] transition-colors"
              >
                Clear Session
              </button>

              <button
                onClick={async () => {
                  if (isBusy) return;
                  setIsBusy(true);
                  await withErrorHandling(
                    () => restartWithHotExit(),
                    "Restart failed"
                  );
                  // Note: If restart succeeds, app will close - setIsBusy won't run
                }}
                disabled={isBusy}
                className="px-3 py-1.5 text-sm bg-[var(--primary-color)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--contrast-text)] rounded border border-[var(--primary-color)] transition-opacity"
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
