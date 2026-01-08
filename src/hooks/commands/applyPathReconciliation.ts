/**
 * Apply Path Reconciliation Results
 *
 * Takes reconciliation results from the pure helper and applies
 * them to the tab and document stores.
 */

import { useTabStore } from "@/stores/tabStore";
import { useDocumentStore } from "@/stores/documentStore";
import type { ReconcileResult } from "@/utils/pathReconciliation";

/**
 * Apply reconciliation results to update open tabs and documents.
 *
 * For update_path: Updates both tab path and document filePath.
 * For mark_missing: Sets isMissing flag on document.
 *
 * @param results - Results from reconcilePathChange
 */
export function applyPathReconciliation(results: ReconcileResult[]): void {
  const tabStore = useTabStore.getState();
  const docStore = useDocumentStore.getState();

  for (const result of results) {
    if (result.action === "update_path") {
      // Find the tab with this path
      const found = tabStore.findTabByFilePath(result.oldPath);
      if (found) {
        tabStore.updateTabPath(found.tab.id, result.newPath);
        docStore.setFilePath(found.tab.id, result.newPath);
      }
    } else if (result.action === "mark_missing") {
      // Find the tab with this path and mark document as missing
      const found = tabStore.findTabByFilePath(result.oldPath);
      if (found) {
        docStore.markMissing(found.tab.id);
      }
    }
  }
}
