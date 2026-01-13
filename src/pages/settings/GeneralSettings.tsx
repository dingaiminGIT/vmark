/**
 * General Settings Section
 *
 * Auto-save, document history, and editor configuration.
 */

import { useSettingsStore } from "@/stores/settingsStore";
import { SettingRow, Toggle, SettingsGroup, Select } from "./components";

export function GeneralSettings() {
  const general = useSettingsStore((state) => state.general);
  const updateSetting = useSettingsStore((state) => state.updateGeneralSetting);

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
        General
      </h2>

      {/* Auto-Save Section */}
      <SettingsGroup title="Auto-Save">
        <SettingRow
          label="Enable auto-save"
          description="Automatically save files when edited"
        >
          <Toggle
            checked={general.autoSaveEnabled}
            onChange={(v) => updateSetting("autoSaveEnabled", v)}
          />
        </SettingRow>
        <SettingRow
          label="Save interval"
          description="Time between auto-saves"
        >
          <Select
            value={String(general.autoSaveInterval)}
            options={[
              { value: "10", label: "10 seconds" },
              { value: "30", label: "30 seconds" },
              { value: "60", label: "1 minute" },
              { value: "120", label: "2 minutes" },
              { value: "300", label: "5 minutes" },
            ]}
            onChange={(v) => updateSetting("autoSaveInterval", Number(v))}
            disabled={!general.autoSaveEnabled}
          />
        </SettingRow>
      </SettingsGroup>

      {/* Document History Section */}
      <SettingsGroup title="Document History">
        <SettingRow
          label="Keep document history"
          description="Track versions for undo and recovery"
        >
          <Toggle
            checked={general.historyEnabled}
            onChange={(v) => updateSetting("historyEnabled", v)}
          />
        </SettingRow>
        <SettingRow
          label="Maximum versions"
          description="Number of snapshots to keep"
        >
          <Select
            value={String(general.historyMaxSnapshots)}
            options={[
              { value: "10", label: "10 versions" },
              { value: "25", label: "25 versions" },
              { value: "50", label: "50 versions" },
              { value: "100", label: "100 versions" },
            ]}
            onChange={(v) => updateSetting("historyMaxSnapshots", Number(v))}
            disabled={!general.historyEnabled}
          />
        </SettingRow>
        <SettingRow
          label="Keep versions for"
          description="Maximum age of history"
        >
          <Select
            value={String(general.historyMaxAgeDays)}
            options={[
              { value: "1", label: "1 day" },
              { value: "7", label: "7 days" },
              { value: "14", label: "14 days" },
              { value: "30", label: "30 days" },
            ]}
            onChange={(v) => updateSetting("historyMaxAgeDays", Number(v))}
            disabled={!general.historyEnabled}
          />
        </SettingRow>
      </SettingsGroup>

      {/* Editor Section */}
      <SettingsGroup title="Editor">
        <SettingRow
          label="Tab size"
          description="Number of spaces inserted when pressing Tab"
        >
          <Select
            value={String(general.tabSize)}
            options={[
              { value: "2", label: "2 spaces" },
              { value: "4", label: "4 spaces" },
            ]}
            onChange={(v) => updateSetting("tabSize", Number(v))}
          />
        </SettingRow>
      </SettingsGroup>
    </div>
  );
}
