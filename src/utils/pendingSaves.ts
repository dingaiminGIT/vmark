/**
 * Pending Saves Tracker
 *
 * Tracks files that were recently saved by the app to avoid false
 * "external modification" dialogs caused by file watcher race conditions.
 *
 * On Windows, the file watcher may fire before markSaved() updates isDirty,
 * causing the external change handler to see isDirty=true for our own saves.
 *
 * Usage:
 * 1. Call registerPendingSave(path) BEFORE writeTextFile()
 * 2. Call clearPendingSave(path) AFTER markSaved() (or after a timeout)
 * 3. Check isPendingSave(path) in external change handler before prompting
 */

import { normalizePath } from "@/utils/paths";

/** Map of normalized path -> timestamp when save started */
const pendingSaves = new Map<string, number>();

/** How long to consider a path as "pending save" (ms) */
const PENDING_SAVE_TTL = 2000;

/**
 * Register that we're about to save a file.
 * Call this BEFORE writeTextFile().
 */
export function registerPendingSave(path: string): void {
  const normalized = normalizePath(path);
  pendingSaves.set(normalized, Date.now());
}

/**
 * Clear a pending save.
 * Call this AFTER markSaved() completes, or let it expire via TTL.
 */
export function clearPendingSave(path: string): void {
  const normalized = normalizePath(path);
  pendingSaves.delete(normalized);
}

/**
 * Check if a path was recently saved by us (within TTL).
 * Returns true if we should ignore external change events for this path.
 */
export function isPendingSave(path: string): boolean {
  const normalized = normalizePath(path);
  const timestamp = pendingSaves.get(normalized);

  if (!timestamp) return false;

  const elapsed = Date.now() - timestamp;
  if (elapsed > PENDING_SAVE_TTL) {
    // Expired - clean up
    pendingSaves.delete(normalized);
    return false;
  }

  return true;
}

/**
 * Clear all pending saves (for testing).
 */
export function clearAllPendingSaves(): void {
  pendingSaves.clear();
}
