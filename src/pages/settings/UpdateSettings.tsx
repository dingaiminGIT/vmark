/**
 * Update Settings Section
 *
 * Settings for automatic update checking and installation.
 */

import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { SettingRow, Toggle, SettingsGroup, Select } from "./components";
import { useSettingsStore, type UpdateCheckFrequency } from "@/stores/settingsStore";
import { useUpdateStore } from "@/stores/updateStore";
import { useUpdateOperations } from "@/hooks/useUpdateOperations";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  RefreshCw,
  SkipForward,
} from "lucide-react";

const frequencyOptions: { value: UpdateCheckFrequency; label: string }[] = [
  { value: "startup", label: "On startup" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "manual", label: "Manual only" },
];

function StatusIndicator() {
  const status = useUpdateStore((state) => state.status);
  const updateInfo = useUpdateStore((state) => state.updateInfo);
  const error = useUpdateStore((state) => state.error);

  if (status === "checking") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
        <Loader2 className="w-3 h-3 animate-spin" />
        Checking...
      </span>
    );
  }

  if (status === "up-to-date") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
        <CheckCircle2 className="w-3 h-3 text-[var(--success-color)]" />
        Up to date
      </span>
    );
  }

  if (status === "available" && updateInfo) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--primary-color)]">
        <Download className="w-3 h-3" />
        {updateInfo.version} available
      </span>
    );
  }

  if (status === "downloading") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
        <Loader2 className="w-3 h-3 animate-spin" />
        Downloading...
      </span>
    );
  }

  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--success-color)]">
        <CheckCircle2 className="w-3 h-3" />
        Ready to install
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--error-color)]">
        <AlertCircle className="w-3 h-3" />
        {error || "Check failed"}
      </span>
    );
  }

  return null;
}

function DownloadProgress() {
  const downloadProgress = useUpdateStore((state) => state.downloadProgress);

  if (!downloadProgress) return null;

  const { downloaded, total } = downloadProgress;
  const percentage = total ? Math.round((downloaded / total) * 100) : 0;
  const downloadedMB = (downloaded / 1024 / 1024).toFixed(1);
  const totalMB = total ? (total / 1024 / 1024).toFixed(1) : "?";

  return (
    <div className="mt-2 space-y-1">
      <div className="flex justify-between text-xs text-[var(--text-tertiary)]">
        <span>Downloading update...</span>
        <span>
          {downloadedMB} / {totalMB} MB ({percentage}%)
        </span>
      </div>
      <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--primary-color)] transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function UpdateAvailableCard() {
  const status = useUpdateStore((state) => state.status);
  const updateInfo = useUpdateStore((state) => state.updateInfo);
  const dismissed = useUpdateStore((state) => state.dismissed);
  const { downloadAndInstall, restartApp, skipVersion } = useUpdateOperations();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  // Listen for restart cancelled event to reset button state
  useEffect(() => {
    const unlistenPromise = listen("update:restart-cancelled", () => {
      setIsRestarting(false);
    });

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  // Reset isDownloading when status changes away from downloading
  useEffect(() => {
    if (status !== "downloading") {
      setIsDownloading(false);
    }
  }, [status]);

  if (!updateInfo) return null;

  // Don't show if dismissed (e.g., version was skipped)
  if (dismissed) return null;

  // Show card for available, downloading, or ready states
  if (status !== "available" && status !== "downloading" && status !== "ready") {
    return null;
  }

  const handleDownload = async () => {
    setIsDownloading(true);
    await downloadAndInstall();
    // Note: isDownloading is reset by the status change effect
  };

  const handleRestart = async () => {
    setIsRestarting(true);
    await restartApp();
    // Note: isRestarting is reset by the restart-cancelled event if user cancels
  };

  const handleSkip = () => {
    skipVersion(updateInfo.version);
  };

  return (
    <SettingsGroup title="Update Available">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--text-primary)]">
                Version {updateInfo.version}
              </span>
              {updateInfo.currentVersion && (
                <span className="text-xs text-[var(--text-tertiary)]">
                  (current: {updateInfo.currentVersion})
                </span>
              )}
            </div>
            {updateInfo.pubDate && (
              <div className="text-xs text-[var(--text-tertiary)] mt-0.5">
                Released: {new Date(updateInfo.pubDate).toLocaleDateString()}
              </div>
            )}
            {updateInfo.notes && (
              <div className="mt-2 text-sm text-[var(--text-secondary)] whitespace-pre-wrap line-clamp-3">
                {updateInfo.notes}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {status === "available" && (
              <>
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="px-3 py-1.5 rounded text-sm font-medium
                             bg-[var(--primary-color)] text-white
                             hover:opacity-90 disabled:opacity-50
                             disabled:cursor-not-allowed transition-opacity
                             flex items-center gap-1.5"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </>
                  )}
                </button>
                <button
                  onClick={handleSkip}
                  className="px-3 py-1.5 rounded text-sm font-medium
                             bg-[var(--bg-tertiary)] text-[var(--text-secondary)]
                             hover:bg-[var(--hover-bg)] transition-colors
                             flex items-center gap-1.5"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Skip
                </button>
              </>
            )}

            {status === "ready" && (
              <button
                onClick={handleRestart}
                disabled={isRestarting}
                className="px-3 py-1.5 rounded text-sm font-medium
                           bg-[var(--success-color)] text-[var(--contrast-text)]
                           hover:opacity-90 disabled:opacity-50
                           disabled:cursor-not-allowed transition-opacity
                           flex items-center gap-1.5"
              >
                {isRestarting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Restarting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Restart to Update
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {status === "downloading" && <DownloadProgress />}
      </div>
    </SettingsGroup>
  );
}

export function UpdateSettings() {
  const updateSettings = useSettingsStore((state) => state.update);
  const updateUpdateSetting = useSettingsStore((state) => state.updateUpdateSetting);
  const status = useUpdateStore((state) => state.status);
  const { checkForUpdates } = useUpdateOperations();
  const [isChecking, setIsChecking] = useState(false);

  const handleAutoCheckChange = (enabled: boolean) => {
    updateUpdateSetting("autoCheckEnabled", enabled);
  };

  const handleFrequencyChange = (frequency: UpdateCheckFrequency) => {
    updateUpdateSetting("checkFrequency", frequency);
  };

  const handleAutoDownloadChange = (enabled: boolean) => {
    updateUpdateSetting("autoDownload", enabled);
  };

  const handleCheckNow = async () => {
    setIsChecking(true);
    try {
      await checkForUpdates();
    } finally {
      setIsChecking(false);
    }
  };

  // Format last check time
  const lastCheckText = updateSettings.lastCheckTimestamp
    ? new Date(updateSettings.lastCheckTimestamp).toLocaleString()
    : "Never";

  // Disable check button during active operations
  const checkDisabled =
    isChecking ||
    status === "checking" ||
    status === "downloading" ||
    status === "ready";

  return (
    <div>
      {/* Update available/downloading/ready card */}
      <UpdateAvailableCard />

      <SettingsGroup title="Automatic Updates">
        <SettingRow
          label="Check for updates automatically"
          description="Periodically check for new versions"
        >
          <Toggle
            checked={updateSettings.autoCheckEnabled}
            onChange={handleAutoCheckChange}
          />
        </SettingRow>

        <SettingRow
          label="Check frequency"
          description="How often to check for updates"
          disabled={!updateSettings.autoCheckEnabled}
        >
          <Select
            value={updateSettings.checkFrequency}
            options={frequencyOptions}
            onChange={handleFrequencyChange}
            disabled={!updateSettings.autoCheckEnabled}
          />
        </SettingRow>

        <SettingRow
          label="Download updates automatically"
          description="Download in the background when available"
        >
          <Toggle
            checked={updateSettings.autoDownload}
            onChange={handleAutoDownloadChange}
          />
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Manual Check">
        <SettingRow label="Check now" description={`Last checked: ${lastCheckText}`}>
          <div className="flex items-center gap-3">
            <StatusIndicator />
            <button
              onClick={handleCheckNow}
              disabled={checkDisabled}
              className="px-3 py-1.5 rounded text-sm font-medium
                         bg-[var(--bg-tertiary)] text-[var(--text-primary)]
                         hover:bg-[var(--hover-bg)] disabled:opacity-50
                         disabled:cursor-not-allowed transition-colors"
            >
              {isChecking || status === "checking" ? "Checking..." : "Check for Updates"}
            </button>
          </div>
        </SettingRow>
      </SettingsGroup>

      {updateSettings.skipVersion && (
        <div className="mt-4 text-xs text-[var(--text-tertiary)]">
          Skipped version: {updateSettings.skipVersion}{" "}
          <button
            onClick={() => updateUpdateSetting("skipVersion", null)}
            className="text-[var(--primary-color)] hover:underline"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
