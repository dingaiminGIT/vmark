/**
 * MCP Configuration Installer Component
 *
 * UI for installing MCP configuration to AI providers.
 */

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SettingsGroup } from "./components";
import { McpConfigPreviewDialog } from "./McpConfigPreviewDialog";

interface ProviderStatus {
  provider: string;
  name: string;
  path: string;
  exists: boolean;
  hasVmark: boolean;
  configuredPort: number | null;
}

interface ConfigPreview {
  provider: string;
  path: string;
  binaryPath: string;
  isDev: boolean;
  currentContent: string | null;
  proposedContent: string;
  backupPath: string;
}

interface InstallResult {
  success: boolean;
  message: string;
  backupPath: string | null;
}

interface UninstallResult {
  success: boolean;
  message: string;
}

function StatusIcon({ installed }: { installed: boolean }) {
  if (installed) {
    return (
      <span className="w-4 h-4 text-green-600 dark:text-green-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }
  return (
    <span className="w-4 h-4 text-[var(--text-tertiary)]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
      </svg>
    </span>
  );
}

interface ProviderRowProps {
  provider: ProviderStatus;
  port: number;
  onPreview: () => void;
  onUninstall: () => void;
  loading: boolean;
}

function ProviderRow({ provider, port, onPreview, onUninstall, loading }: ProviderRowProps) {
  const needsUpdate = provider.hasVmark && provider.configuredPort !== port;

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <StatusIcon installed={provider.hasVmark && !needsUpdate} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[var(--text-primary)] truncate">
            {provider.name}
          </div>
          <div className="text-xs text-[var(--text-tertiary)] font-mono truncate">
            {provider.path.replace(/^\/Users\/[^/]+/, "~")}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-3">
        {provider.hasVmark && needsUpdate && (
          <span className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">
            Port mismatch
          </span>
        )}
        {provider.hasVmark ? (
          <>
            <button
              onClick={onPreview}
              disabled={loading}
              className="px-2.5 py-1 text-xs font-medium rounded border
                        border-gray-200 dark:border-gray-700 bg-transparent
                        text-[var(--text-primary)] hover:bg-[var(--hover-bg)]
                        disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Update
            </button>
            <button
              onClick={onUninstall}
              disabled={loading}
              className="px-2.5 py-1 text-xs font-medium rounded border
                        border-gray-200 dark:border-gray-700 bg-transparent
                        text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20
                        disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove
            </button>
          </>
        ) : (
          <button
            onClick={onPreview}
            disabled={loading}
            className="px-2.5 py-1 text-xs font-medium rounded
                      bg-[var(--accent-primary)] text-white
                      hover:opacity-90
                      disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}

interface McpConfigInstallerProps {
  port: number;
}

export function McpConfigInstaller({ port }: McpConfigInstallerProps) {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [preview, setPreview] = useState<ConfigPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const statuses = await invoke<ProviderStatus[]>("mcp_config_get_status");
      setProviders(statuses);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handlePreview = async (providerId: string) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const previewData = await invoke<ConfigPreview>("mcp_config_preview", {
        provider: providerId,
        port,
      });
      setPreview(previewData);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<InstallResult>("mcp_config_install", {
        provider: preview.provider,
        port,
      });
      if (result.success) {
        setSuccessMessage(result.message);
        setPreview(null);
        await loadStatus();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUninstall = async (providerId: string) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await invoke<UninstallResult>("mcp_config_uninstall", {
        provider: providerId,
      });
      if (result.success) {
        setSuccessMessage(result.message);
        await loadStatus();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsGroup title="Install MCP Configuration" className="mb-0">
      <div className="text-xs text-[var(--text-tertiary)] mb-3">
        Configure AI assistants to connect to VMark MCP server.
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {providers.map((provider) => (
          <ProviderRow
            key={provider.provider}
            provider={provider}
            port={port}
            onPreview={() => handlePreview(provider.provider)}
            onUninstall={() => handleUninstall(provider.provider)}
            loading={loading}
          />
        ))}
        {providers.length === 0 && (
          <div className="py-4 text-center text-sm text-[var(--text-tertiary)]">
            Loading providers...
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 text-xs text-red-500">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mt-2 text-xs text-green-600 dark:text-green-400">
          {successMessage}
        </div>
      )}

      {preview && (
        <McpConfigPreviewDialog
          preview={preview}
          onConfirm={handleInstall}
          onCancel={() => setPreview(null)}
          loading={loading}
        />
      )}
    </SettingsGroup>
  );
}
