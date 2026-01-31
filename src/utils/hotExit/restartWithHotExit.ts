/**
 * Hot Exit Restart Helper
 *
 * Captures session before restart and restores after relaunch.
 */

import { invoke } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import type { SessionData } from './types';

/**
 * Capture session, write to disk, then restart app.
 * Session will be automatically restored on next startup via useHotExitRestore.
 */
export async function restartWithHotExit(): Promise<void> {
  try {
    // Capture session from all windows and write atomically to disk
    // This command waits for all windows to respond with 5s timeout
    const session: SessionData = await invoke('hot_exit_test_capture');

    console.log('[HotExit] Session captured successfully:', {
      windows: session.windows.length,
      version: session.vmark_version,
    });

    // Relaunch app - session will be restored on startup
    await relaunch();
  } catch (error) {
    console.error('[HotExit] Failed to capture session before restart:', error);
    // Fallback: restart anyway (user already confirmed)
    await relaunch();
  }
}

/**
 * Check for saved session on startup and restore if present.
 * Called from App.tsx during initialization.
 */
export async function checkAndRestoreSession(): Promise<boolean> {
  try {
    const session: SessionData | null = await invoke('hot_exit_inspect_session');

    if (!session) {
      console.log('[HotExit] No saved session found');
      return false;
    }

    console.log('[HotExit] Found saved session:', {
      windows: session.windows.length,
      timestamp: new Date(session.timestamp * 1000).toISOString(),
      version: session.vmark_version,
    });

    // Restore session to main window
    // The useHotExitRestore hook will handle the actual restoration
    await invoke('hot_exit_test_restore', { session });

    // Delete session file after successful restore
    await invoke('hot_exit_clear_session');

    console.log('[HotExit] Session restored and cleared successfully');
    return true;
  } catch (error) {
    console.error('[HotExit] Failed to restore session:', error);
    return false;
  }
}
