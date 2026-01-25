/**
 * Integrations Settings Section
 *
 * MCP server and AI assistant integration settings.
 */

import { useState } from "react";
import { SettingRow, Toggle, SettingsGroup } from "./components";
import { useSettingsStore } from "@/stores/settingsStore";
import { useMcpServer } from "@/hooks/useMcpServer";
import { McpConfigInstaller } from "./McpConfigInstaller";

function StatusBadge({ running, loading }: { running: boolean; loading: boolean }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
        <span className="w-2 h-2 rounded-full bg-[var(--warning-color)] animate-pulse" />
        Starting...
      </span>
    );
  }

  if (running) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--success-color)]">
        <span className="w-2 h-2 rounded-full bg-[var(--success-color)]" />
        Running
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
      <span className="w-2 h-2 rounded-full bg-[var(--text-tertiary)]" />
      Stopped
    </span>
  );
}

export function IntegrationsSettings() {
  const mcpSettings = useSettingsStore((state) => state.advanced.mcpServer);
  const updateAdvancedSetting = useSettingsStore((state) => state.updateAdvancedSetting);

  const { running, port, loading, error, start, stop } = useMcpServer();

  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!port) return;
    const address = `localhost:${port}`;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleToggleServer = async (enabled: boolean) => {
    if (enabled) {
      try {
        await start();
      } catch {
        // Error is handled by hook
      }
    } else {
      try {
        await stop();
      } catch {
        // Error is handled by hook
      }
    }
  };

  const handleAutoStartChange = (enabled: boolean) => {
    updateAdvancedSetting("mcpServer", { ...mcpSettings, autoStart: enabled });
  };

  // Called after MCP config is successfully installed to a provider
  // Enables autoStart and starts the bridge so it works immediately
  const handleMcpConfigInstalled = async () => {
    // Enable autoStart so bridge runs on future launches
    if (!mcpSettings.autoStart) {
      updateAdvancedSetting("mcpServer", { ...mcpSettings, autoStart: true });
    }
    // Start the bridge now if not already running
    if (!running && !loading) {
      try {
        await start();
      } catch {
        // Error handled by hook, user can see status indicator
      }
    }
  };

  return (
    <div>
      <SettingsGroup title="MCP Server">
        <SettingRow
          label="Enable MCP Server"
          description="Allow AI assistants to control VMark editor"
        >
          <div className="flex items-center gap-3">
            <StatusBadge running={running} loading={loading} />
            <Toggle
              checked={running}
              onChange={handleToggleServer}
              disabled={loading}
            />
          </div>
        </SettingRow>

        <SettingRow
          label="Start on launch"
          description="Auto-start when VMark opens"
        >
          <Toggle
            checked={mcpSettings.autoStart}
            onChange={handleAutoStartChange}
          />
        </SettingRow>

        {error && (
          <div className="mt-2 text-xs text-[var(--error-color)]">
            {error}
          </div>
        )}

        {running && port && (
          <div className="mt-4 pt-3 border-t border-[var(--border-color)]">
            <div className="text-xs text-[var(--text-tertiary)] flex items-center gap-1.5">
              <span>Listening on</span>
              <code className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono">
                localhost:{port}
              </code>
              <button
                onClick={handleCopyAddress}
                className="p-0.5 rounded hover:bg-[var(--hover-bg)] text-[var(--text-tertiary)]
                          hover:text-[var(--text-primary)] transition-colors"
                title={copied ? "Copied!" : "Copy address"}
              >
                {copied ? (
                  <svg className="w-3.5 h-3.5 text-[var(--success-color)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>
            <div className="text-xs text-[var(--text-tertiary)] mt-1">
              Port auto-assigned. AI clients discover it automatically.
            </div>
          </div>
        )}
      </SettingsGroup>

      <div className="mt-6">
        <McpConfigInstaller onInstallSuccess={handleMcpConfigInstalled} />
      </div>
    </div>
  );
}
