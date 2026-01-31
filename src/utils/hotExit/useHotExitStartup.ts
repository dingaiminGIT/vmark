/**
 * Hot Exit Startup Hook
 *
 * Checks for saved session on app startup and triggers restore if present.
 * Should be called once in the main window only.
 */

import { useEffect, useRef } from 'react';
import { checkAndRestoreSession } from './restartWithHotExit';

export function useHotExitStartup() {
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    // Check for saved session and restore if present
    // This runs once on app startup in the main window
    const checkSession = async () => {
      const restored = await checkAndRestoreSession();
      if (restored) {
        console.log('[HotExit] Startup: session restored successfully');
      }
    };

    checkSession();
  }, []);
}
