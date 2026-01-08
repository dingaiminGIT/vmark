/**
 * Advanced Settings Section
 *
 * Developer and system configuration.
 */

import { useState } from "react";
import { SettingRow, Toggle } from "./components";

export function AdvancedSettings() {
  const [devTools, setDevTools] = useState(false);
  const [hardwareAccel, setHardwareAccel] = useState(true);

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
        Advanced
      </h2>
      <div className="space-y-1">
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
    </div>
  );
}
