/**
 * Files Settings Section
 *
 * File handling configuration.
 */

import { useState } from "react";
import { SettingRow, Toggle } from "./components";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { updateWorkspaceConfig } from "@/hooks/workspaceConfig";

export function FilesSettings() {
  const [defaultDir, setDefaultDir] = useState("~/Documents");
  const [createBackups, setCreateBackups] = useState(true);
  const isWorkspaceMode = useWorkspaceStore((state) => state.isWorkspaceMode);
  const showHiddenFiles = useWorkspaceStore(
    (state) => state.config?.showHiddenFiles ?? false
  );

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
        Files
      </h2>
      <div className="space-y-1">
        <SettingRow
          label="Show hidden files"
          description="Include dotfiles and hidden system items in the file explorer"
          disabled={!isWorkspaceMode}
        >
          <Toggle
            checked={showHiddenFiles}
            onChange={(value) => {
              void updateWorkspaceConfig({ showHiddenFiles: value });
            }}
            disabled={!isWorkspaceMode}
          />
        </SettingRow>
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
