/**
 * Update Indicator Component
 *
 * Shows update status in the StatusBar as icon-only:
 * - Hidden when idle, up-to-date, or available (with auto-download)
 * - Spinning icon when checking (no action)
 * - Pulsing icon when downloading (no action)
 * - Static icon with dot when ready (click to restart)
 * - Error icon when error (click to retry)
 */

import { RefreshCw, Download, CheckCircle, AlertCircle } from "lucide-react";
import { useUpdateStore, type UpdateStatus } from "@/stores/updateStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUpdateOperations } from "@/hooks/useUpdateOperations";

/**
 * Get indicator config based on update status
 */
function getIndicatorConfig(status: UpdateStatus) {
  switch (status) {
    case "checking":
      return {
        icon: RefreshCw,
        title: "Checking for updates...",
        className: "status-update checking",
        showDot: false,
        clickable: false,
      };
    case "downloading":
      return {
        icon: Download,
        title: "Downloading update...",
        className: "status-update downloading",
        showDot: false,
        clickable: false,
      };
    case "available":
      return {
        icon: Download,
        title: "Update available",
        className: "status-update available",
        showDot: true,
        clickable: false, // Auto-download will handle it
      };
    case "ready":
      return {
        icon: CheckCircle,
        title: "Click to restart and update",
        className: "status-update ready",
        showDot: true,
        clickable: true,
      };
    case "error":
      return {
        icon: AlertCircle,
        title: "Update check failed — click to retry",
        className: "status-update error",
        showDot: false,
        clickable: true,
      };
    default:
      return null;
  }
}

export function UpdateIndicator() {
  const status = useUpdateStore((state) => state.status);
  const updateInfo = useUpdateStore((state) => state.updateInfo);
  const downloadProgress = useUpdateStore((state) => state.downloadProgress);
  const autoDownload = useSettingsStore((state) => state.update.autoDownload);
  const { checkForUpdates, restartApp } = useUpdateOperations();

  const config = getIndicatorConfig(status);

  // Don't render for idle or up-to-date states
  if (!config) return null;

  // Skip "available" state when auto-download is on (it transitions immediately to downloading)
  if (status === "available" && autoDownload) return null;

  const Icon = config.icon;

  // Calculate download percentage for tooltip
  const downloadPercent =
    status === "downloading" && downloadProgress?.total
      ? Math.round((downloadProgress.downloaded / downloadProgress.total) * 100)
      : null;

  // Build title with additional context
  let title = config.title;
  if (status === "available" && updateInfo) {
    title = `Update available: v${updateInfo.version}`;
  } else if (status === "downloading") {
    title = downloadPercent !== null ? `Downloading: ${downloadPercent}%` : "Downloading update...";
  } else if (status === "ready" && updateInfo) {
    title = `v${updateInfo.version} ready — click to restart`;
  }

  const handleClick = () => {
    if (!config.clickable) return;

    if (status === "ready") {
      restartApp();
    } else if (status === "error") {
      checkForUpdates();
    }
  };

  return (
    <button
      className={config.className}
      onClick={handleClick}
      title={title}
      style={{ cursor: config.clickable ? "pointer" : "default" }}
    >
      <Icon size={12} />
      {config.showDot && <span className="status-update-dot" />}
    </button>
  );
}

export default UpdateIndicator;
