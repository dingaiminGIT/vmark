/**
 * Hot Exit Restart Helper
 *
 * Captures session before restart and restores after relaunch.
 *
 * CRITICAL: Session file lifecycle:
 * - Captured before restart
 * - Deleted ONLY after restore-complete event (not before!)
 * - Kept on failure for retry on next launch
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { relaunch } from '@tauri-apps/plugin-process';
import type { SessionData } from './types';
import { HOT_EXIT_EVENTS } from './types';
import { migrateSession, canMigrate, needsMigration, SCHEMA_VERSION } from './schemaMigration';

/** Default timeout for restore operation in milliseconds */
const DEFAULT_RESTORE_TIMEOUT_MS = 15000;

/**
 * Capture session, write to disk, then restart app.
 * Session will be automatically restored on next startup via useHotExitRestore.
 */
export async function restartWithHotExit(): Promise<void> {
  try {
    // Capture session from all windows and write atomically to disk
    // This command waits for all windows to respond with 5s timeout
    const session = await invoke<SessionData>('hot_exit_capture');

    console.log('[HotExit] Session captured and persisted:', {
      windows: session.windows.length,
      version: session.vmark_version,
    });
  } catch (error) {
    const captureError = error instanceof Error ? error : new Error(String(error));
    console.error('[HotExit] Failed to capture session before restart:', captureError);
    // Continue to relaunch - user already confirmed restart
  }

  // Relaunch regardless of capture success (user confirmed restart)
  try {
    await relaunch();
  } catch (error) {
    console.error('[HotExit] Failed to relaunch:', error);
    throw error;
  }
}

/**
 * Check for saved session on startup and restore if present.
 * Called from App.tsx during initialization.
 * MUST only be called from the main window to avoid concurrent restore attempts.
 *
 * CRITICAL: Session file is ONLY deleted after restore-complete event is received.
 * If restore fails or times out, session is preserved for retry on next launch.
 *
 * @param timeoutMs - Maximum time to wait for restore completion (default: 15000ms)
 * @returns true if restore completed successfully, false otherwise
 */
export async function checkAndRestoreSession(
  timeoutMs: number = DEFAULT_RESTORE_TIMEOUT_MS
): Promise<boolean> {
  try {
    const session = await invoke<SessionData | null>('hot_exit_inspect_session');

    if (!session) {
      console.log('[HotExit] No saved session found');
      return false;
    }

    // Check if session can be migrated
    if (!canMigrate(session.version)) {
      console.error(`[HotExit] Cannot restore session: incompatible version ${session.version} (current: ${SCHEMA_VERSION})`);
      // Clear incompatible session to prevent repeated restore attempts on every launch
      try {
        await invoke<void>('hot_exit_clear_session');
        console.log('[HotExit] Cleared incompatible session file');
      } catch (clearError) {
        console.warn('[HotExit] Failed to clear incompatible session:', clearError);
      }
      return false;
    }

    // Migrate session if needed (frontend applies migration before sending to Rust)
    let migratedSession = session;
    if (needsMigration(session)) {
      console.log(`[HotExit] Migrating session from v${session.version} to v${SCHEMA_VERSION}`);
      migratedSession = migrateSession(session);
    }

    const hasSecondaryWindows = migratedSession.windows.some(w => !w.is_main_window);

    console.log('[HotExit] Found saved session:', {
      windows: migratedSession.windows.length,
      hasSecondaryWindows,
      timestamp: new Date(migratedSession.timestamp * 1000).toISOString(),
      version: migratedSession.vmark_version,
      schemaVersion: migratedSession.version,
    });

    // CRITICAL: Set up event listeners BEFORE invoking restore commands
    // This prevents race conditions where fast events could be missed
    const restorePromise = waitForRestoreEvent(timeoutMs);

    // Use multi-window restore if session has secondary windows
    // Otherwise use legacy single-window restore
    if (hasSecondaryWindows) {
      const result = await invoke<{ windows_created: string[] }>(
        'hot_exit_restore_multi_window',
        { session: migratedSession }
      );
      console.log('[HotExit] Multi-window restore initiated:', {
        windowsCreated: result.windows_created,
      });
    } else {
      // Legacy single-window restore
      await invoke<void>('hot_exit_restore', { session: migratedSession });
    }

    // CRITICAL: Wait for restore to complete BEFORE deleting session
    // This prevents data loss if restore fails partway through
    const restoreResult = await restorePromise;

    if (restoreResult.success) {
      // Only delete session file after confirmed successful restore
      try {
        await invoke<void>('hot_exit_clear_session');
        console.log('[HotExit] Session restored and cleared successfully');
      } catch (clearError) {
        console.warn('[HotExit] Failed to clear session file:', clearError);
        // Still return true since restore succeeded
      }
      return true;
    } else {
      // Restore failed or timed out - keep session file for retry
      console.error('[HotExit] Restore failed:', restoreResult.error);
      console.log('[HotExit] Session file preserved for retry on next launch');
      return false;
    }
  } catch (error) {
    console.error('[HotExit] Failed to restore session:', error);
    return false;
  }
}

/**
 * Wait for restore-complete or restore-failed event.
 *
 * @param timeoutMs - Maximum time to wait
 * @returns Object indicating success or failure with optional error
 */
async function waitForRestoreEvent(
  timeoutMs: number
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    let resolved = false;
    let unlistenComplete: (() => void) | undefined;
    let unlistenFailed: (() => void) | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      // Safe cleanup - functions might not be assigned yet
      if (unlistenComplete) {
        unlistenComplete();
        unlistenComplete = undefined;
      }
      if (unlistenFailed) {
        unlistenFailed();
        unlistenFailed = undefined;
      }
    };

    const handleResolve = (result: { success: boolean; error?: string }) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(result);
    };

    // Set up listeners FIRST, then timeout
    // This ensures listeners are ready before any events can arrive
    const setupListeners = async () => {
      try {
        // Register listeners - they're active immediately after await resolves
        const [completeUnsub, failedUnsub] = await Promise.all([
          listen(HOT_EXIT_EVENTS.RESTORE_COMPLETE, () => {
            handleResolve({ success: true });
          }),
          listen<{ error: string }>(HOT_EXIT_EVENTS.RESTORE_FAILED, (event) => {
            handleResolve({ success: false, error: event.payload.error });
          }),
        ]);

        // Store unsubscribers for cleanup
        // Check if already resolved (timeout or error happened during setup)
        if (resolved) {
          completeUnsub();
          failedUnsub();
          return;
        }

        unlistenComplete = completeUnsub;
        unlistenFailed = failedUnsub;

        // Now set up timeout AFTER listeners are ready
        timeoutId = setTimeout(() => {
          handleResolve({ success: false, error: 'Restore timed out' });
        }, timeoutMs);
      } catch (error) {
        handleResolve({
          success: false,
          error: `Failed to set up event listeners: ${error}`,
        });
      }
    };

    setupListeners();
  });
}
