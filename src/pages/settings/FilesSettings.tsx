/**
 * Files Settings Section
 *
 * File handling configuration.
 */

import { useState } from "react";
import { SettingRow, Toggle } from "./components";

export function FilesSettings() {
  const [defaultDir, setDefaultDir] = useState("~/Documents");
  const [createBackups, setCreateBackups] = useState(true);

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
        Files
      </h2>
      <div className="space-y-1">
        <SettingRow
          label="Default directory"
          description="Where new files are saved"
        >
          <input
            type="text"
            value={defaultDir}
            onChange={(e) => setDefaultDir(e.target.value)}
            className="w-48 px-2 py-1 rounded border border-gray-200 dark:border-gray-700
                       bg-[var(--bg-primary)] text-sm text-[var(--text-primary)]"
          />
        </SettingRow>
        <SettingRow
          label="Create backups"
          description="Save backup copies of files"
        >
          <Toggle checked={createBackups} onChange={setCreateBackups} />
        </SettingRow>
      </div>
    </div>
  );
}
