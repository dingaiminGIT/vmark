/**
 * MCP Configuration Installer Component
 *
 * UI for installing MCP configuration to AI providers.
 * Shows diagnostics including path validation status.
 */

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SettingsGroup, Button } from "./components";
import { McpConfigPreviewDialog } from "./McpConfigPreviewDialog";
import { getFileName, normalizePath } from "@/utils/paths";

type DiagnosticStatus = "Valid" | "PathMismatch" | "BinaryMissing" | "NotConfigured";

interface ProviderDiagnostic {
  provider: string;
  name: string;
  configPath: string;
  configExists: boolean;
  hasVmark: boolean;
  expectedBinaryPath: string | null;
  configuredBinaryPath: string | null;
  binaryExists: boolean;
  status: DiagnosticStatus;
  message: string;
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

function DiagnosticIcon({ status }: { status: DiagnosticStatus }) {
  switch (status) {
    case "Valid":
      return (
        <span className="w-4 h-4 text-[var(--success-color)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      );
    case "PathMismatch":
      return (
        <span className="w-4 h-4 text-[var(--warning-color)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </span>
      );
    case "BinaryMissing":
      return (
        <span className="w-4 h-4 text-[var(--error-color)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </span>
      );
    case "NotConfigured":
    default:
      return (
        <span className="w-4 h-4 text-[var(--text-tertiary)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
          </svg>
        </span>
      );
  }
}

function CopyButton({ text, size = "sm" }: { text: string; size?: "sm" | "xs" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-3 h-3";

  return (
    <button
      onClick={handleCopy}
      className="p-0.5 rounded hover:bg-[var(--hover-bg)] text-[var(--text-tertiary)]
                hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
      title={copied ? "Copied!" : "Copy path"}
    >
      {copied ? (
        <svg className={`${iconSize} text-[var(--success-color)]`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg className={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

/** Shorten path to just filename for display */
function shortenPath(path: string): string {
  return getFileName(path) || path;
}

/** Format path for tooltip (replace home with ~) */
function formatPath(path: string): string {
  const normalized = normalizePath(path);
  // Handle both Unix (/Users/...) and Windows (C:/Users/...) home paths
  return normalized
    .replace(/^\/Users\/[^/]+/, "~")
    .replace(/^[A-Za-z]:\/Users\/[^/]+/, "~");
}

interface ProviderRowProps {
  diagnostic: ProviderDiagnostic;
  onPreview: () => void;
  onRepair: () => void;
  onUninstall: () => void;
  loading: boolean;
}

function ProviderRow({ diagnostic, onPreview, onRepair, onUninstall, loading }: ProviderRowProps) {
  const showRepairButton = diagnostic.status === "PathMismatch";
  const showUpdateRemove = diagnostic.hasVmark && diagnostic.status !== "PathMismatch";
  const showInstall = !diagnostic.hasVmark;

  return (
    <div className="flex flex-col py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <DiagnosticIcon status={diagnostic.status} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-[var(--text-primary)] truncate">
              {diagnostic.name}
            </div>
            <div className="flex items-center gap-1">
              <span
                className="text-xs text-[var(--text-tertiary)] font-mono truncate"
                title={formatPath(diagnostic.configPath)}
              >
                {shortenPath(diagnostic.configPath)}
              </span>
              <CopyButton text={diagnostic.configPath} size="xs" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3">
          {showRepairButton && (
            <>
              <Button size="sm" variant="warning" onClick={onRepair} disabled={loading}>
                Repair
              </Button>
              <Button size="sm" onClick={onPreview} disabled={loading}>
                Update
              </Button>
              <Button size="sm" variant="danger" onClick={onUninstall} disabled={loading}>
                Remove
              </Button>
            </>
          )}
          {showUpdateRemove && (
            <>
              <Button size="sm" onClick={onPreview} disabled={loading}>
                Update
              </Button>
              <Button size="sm" variant="danger" onClick={onUninstall} disabled={loading}>
                Remove
              </Button>
            </>
          )}
          {showInstall && (
            <Button size="sm" variant="primary" onClick={onPreview} disabled={loading}>
              Install
            </Button>
          )}
        </div>
      </div>
      {diagnostic.message && (
        <div className="mt-1 ml-6.5 text-xs text-[var(--warning-color)]">
          {diagnostic.message}
        </div>
      )}
    </div>
  );
}

interface McpConfigInstallerProps {
  /** Called after successful install - used to enable autoStart and start bridge */
  onInstallSuccess?: () => void;
}

export function McpConfigInstaller({ onInstallSuccess }: McpConfigInstallerProps) {
  const [diagnostics, setDiagnostics] = useState<ProviderDiagnostic[]>([]);
  const [preview, setPreview] = useState<ConfigPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showRestartHint, setShowRestartHint] = useState(false);

  const loadDiagnostics = useCallback(async () => {
    try {
      const results = await invoke<ProviderDiagnostic[]>("mcp_config_diagnose");
      setDiagnostics(results);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  const handlePreview = async (providerId: string) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setShowRestartHint(false);
    try {
      const previewData = await invoke<ConfigPreview>("mcp_config_preview", {
        provider: providerId,
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
      });
      if (result.success) {
        setSuccessMessage(result.message);
        setShowRestartHint(true);
        setPreview(null);
        await loadDiagnostics();
        // Enable autoStart and start bridge after successful install
        onInstallSuccess?.();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRepair = async (providerId: string) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setShowRestartHint(false);
    try {
      const result = await invoke<InstallResult>("mcp_config_install", {
        provider: providerId,
      });
      if (result.success) {
        setSuccessMessage("Configuration repaired successfully");
        setShowRestartHint(true);
        await loadDiagnostics();
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
    setShowRestartHint(false);
    try {
      const result = await invoke<UninstallResult>("mcp_config_uninstall", {
        provider: providerId,
      });
      if (result.success) {
        setSuccessMessage(result.message);
        await loadDiagnostics();
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

      <div>
        {diagnostics.map((diagnostic) => (
          <ProviderRow
            key={diagnostic.provider}
            diagnostic={diagnostic}
            onPreview={() => handlePreview(diagnostic.provider)}
            onRepair={() => handleRepair(diagnostic.provider)}
            onUninstall={() => handleUninstall(diagnostic.provider)}
            loading={loading}
          />
        ))}
        {diagnostics.length === 0 && (
          <div className="py-4 text-center text-sm text-[var(--text-tertiary)]">
            Loading providers...
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 text-xs text-[var(--error-color)]">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mt-2 text-xs text-[var(--success-color)]">
          {successMessage}
          {showRestartHint && (
            <span className="text-[var(--text-tertiary)] ml-1">
              — Restart the AI provider to apply changes.
            </span>
          )}
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
