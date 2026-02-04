/**
 * Hot Exit Coordination
 *
 * Provides coordination between hot exit restore and other startup hooks.
 * Critical: Finder file open must wait for hot exit restore to complete
 * to prevent race conditions that could cause data loss.
 *
 * @module utils/hotExit/hotExitCoordination
 */

// Global state for restore coordination
let restoreInProgress = false;
const pendingWaiters: Array<() => void> = [];

/**
 * Check if a hot exit restore is currently in progress.
 *
 * Other startup hooks should check this and wait if true.
 */
export function isRestoreInProgress(): boolean {
  return restoreInProgress;
}

/**
 * Set the restore in progress flag.
 *
 * Called by useHotExitStartup when starting/completing restore.
 */
export function setRestoreInProgress(inProgress: boolean): void {
  restoreInProgress = inProgress;
}

/**
 * Wait for hot exit restore to complete.
 *
 * Returns a promise that resolves when restore is complete (or wasn't in progress).
 *
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 10000)
 * @returns true if restore completed, false if timed out
 */
export function waitForRestoreComplete(timeoutMs = 10000): Promise<boolean> {
  // If restore not in progress, resolve immediately
  if (!restoreInProgress) {
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    let resolved = false;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        // Remove this waiter from pending list
        const index = pendingWaiters.indexOf(waiterCallback);
        if (index !== -1) {
          pendingWaiters.splice(index, 1);
        }
        resolve(false); // Timed out
      }
    }, timeoutMs);

    // Callback to be called when restore completes
    const waiterCallback = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve(true);
      }
    };

    // Add to pending waiters
    pendingWaiters.push(waiterCallback);
  });
}

/**
 * Notify that hot exit restore has completed.
 *
 * Clears the in-progress flag and resolves all pending waiters.
 */
export function notifyRestoreComplete(): void {
  restoreInProgress = false;

  // Resolve all pending waiters
  while (pendingWaiters.length > 0) {
    const waiter = pendingWaiters.shift();
    if (waiter) {
      waiter();
    }
  }
}

/**
 * Reset coordination state (for testing).
 */
export function resetCoordinationState(): void {
  restoreInProgress = false;
  pendingWaiters.length = 0;
}
