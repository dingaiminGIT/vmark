/**
 * Advanced Settings Section
 *
 * Developer and system configuration.
 */

import { useState } from "react";
import { SettingRow, SettingsGroup, Toggle, TagInput } from "./components";
import { useSettingsStore } from "@/stores/settingsStore";

export function AdvancedSettings() {
  const [devTools, setDevTools] = useState(false);
  const [hardwareAccel, setHardwareAccel] = useState(true);
  const terminalEnabled = useSettingsStore((state) => state.advanced.terminalEnabled);
  const customLinkProtocols = useSettingsStore((state) => state.advanced.customLinkProtocols);
  const updateAdvancedSetting = useSettingsStore((state) => state.updateAdvancedSetting);

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
        Advanced
      </h2>
      <div className="space-y-1">
        <SettingRow
          label="Enable terminal"
          description="Show integrated terminal panel (Ctrl+`)"
        >
          <Toggle
            checked={terminalEnabled}
            onChange={(v) => updateAdvancedSetting("terminalEnabled", v)}
          />
        </SettingRow>
        <SettingRow label="Developer tools" description="Enable developer mode">
          <Toggle checked={devTools} onChange={setDevTools} />
        </SettingRow>
        <SettingRow
          label="Hardware acceleration"
          description="Use GPU for rendering"
        >
          <Toggle checked={hardwareAccel} onChange={setHardwareAccel} />
        </SettingRow>
      </div>

      <SettingsGroup title="Link Protocols" className="mt-6">
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
    </div>
  );
}
