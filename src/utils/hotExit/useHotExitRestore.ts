/**
 * Hot Exit Restore Hook
 *
 * Restores window state after hot restart. Uses a pull-based approach
 * for reliability — windows pull their state from Rust coordinator
 * rather than waiting for events (which can be missed due to timing).
 *
 * For main window: Receives RESTORE_START signal, then pulls state
 * For secondary windows: Pulls pending state via invoke on mount
 */

import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useTabStore } from '@/stores/tabStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useUIStore } from '@/stores/uiStore';
import { useEditorStore } from '@/stores/editorStore';
import { useUnifiedHistoryStore } from '@/stores/unifiedHistoryStore';
import type { WindowState, HistoryCheckpoint } from './types';
import { HOT_EXIT_EVENTS } from './types';
import type { LineEnding } from '@/utils/linebreakDetection';
import type { HistoryCheckpoint as StoreHistoryCheckpoint } from '@/stores/unifiedHistoryStore';

/** Maximum retries when pulling state (handles timing issues) */
const MAX_STATE_RETRIES = 5;
/** Delay between retries in milliseconds */
const RETRY_DELAY_MS = 100;

/**
 * Convert hot exit line ending format back to store format
 */
function fromHotExitLineEnding(lineEnding: '\n' | '\r\n' | 'unknown'): LineEnding {
  switch (lineEnding) {
    case '\n':
      return 'lf';
    case '\r\n':
      return 'crlf';
    case 'unknown':
      return 'unknown';
  }
}

/**
 * Convert hot exit checkpoint back to store format
 */
function fromHotExitCheckpoint(checkpoint: HistoryCheckpoint): StoreHistoryCheckpoint {
  return {
    markdown: checkpoint.markdown,
    mode: checkpoint.mode as 'source' | 'wysiwyg',
    cursorInfo: checkpoint.cursor_info
      ? {
          sourceLine: checkpoint.cursor_info.source_line,
          wordAtCursor: checkpoint.cursor_info.word_at_cursor,
          offsetInWord: checkpoint.cursor_info.offset_in_word,
          nodeType: checkpoint.cursor_info.node_type as import('@/types/cursorSync').NodeType,
          percentInLine: checkpoint.cursor_info.percent_in_line,
          contextBefore: checkpoint.cursor_info.context_before,
          contextAfter: checkpoint.cursor_info.context_after,
          blockAnchor: checkpoint.cursor_info.block_anchor as import('@/types/cursorSync').BlockAnchor | undefined,
        }
      : null,
    timestamp: checkpoint.timestamp,
  };
}

export function useHotExitRestore() {
  // Prevent concurrent restore attempts
  const isRestoring = useRef(false);
  const hasCheckedPending = useRef(false);

  useEffect(() => {
    const windowLabel = getCurrentWebviewWindow().label;
    const isMainWindow = windowLabel === 'main';

    /**
     * Pull window state from Rust coordinator with retry logic.
     * Handles timing issues where state might not be stored yet.
     */
    const pullWindowState = async (retries = MAX_STATE_RETRIES): Promise<WindowState | null> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const windowState = await invoke<WindowState | null>(
            'hot_exit_get_window_state',
            { windowLabel }
          );

          if (windowState) {
            return windowState;
          }

          // State not found - wait and retry (might not be stored yet)
          if (attempt < retries) {
            console.log(`[HotExit] Window '${windowLabel}' state not ready, retry ${attempt}/${retries}`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          }
        } catch (error) {
          console.error(`[HotExit] Failed to pull state for '${windowLabel}' (attempt ${attempt}):`, error);
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          }
        }
      }
      return null;
    };

    /**
     * Restore this window's state by pulling from Rust coordinator.
     * Used by both main and secondary windows for consistency.
     */
    const restoreFromPulledState = async () => {
      if (isRestoring.current) {
        console.warn(`[HotExit] Window '${windowLabel}' ignoring concurrent restore`);
        return;
      }

      isRestoring.current = true;

      try {
        const windowState = await pullWindowState();

        if (!windowState) {
          console.warn(`[HotExit] No state found for window '${windowLabel}' after ${MAX_STATE_RETRIES} retries`);
          // Still signal completion to unblock other windows
          await invoke('hot_exit_window_restore_complete', { windowLabel });
          return;
        }

        console.log(`[HotExit] Window '${windowLabel}' found pending state, restoring...`);
        await restoreWindowState(windowLabel, windowState);

        // Signal completion for this window and check if all windows done
        const allDone = await invoke<boolean>('hot_exit_window_restore_complete', { windowLabel });
        console.log(`[HotExit] Window '${windowLabel}' restored successfully (allDone: ${allDone})`);

        // Only emit RESTORE_COMPLETE when ALL windows have completed
        if (allDone) {
          await emit(HOT_EXIT_EVENTS.RESTORE_COMPLETE, {});
        }
      } catch (error) {
        console.error(`[HotExit] Window '${windowLabel}' restore failed:`, error);
        void emit(HOT_EXIT_EVENTS.RESTORE_FAILED, {
          error: error instanceof Error ? error.message : String(error),
        }).catch((e) => console.error('[HotExit] Failed to emit restore failed:', e));
      } finally {
        isRestoring.current = false;
      }
    };

    // For secondary windows: check for pending state immediately on mount
    // (they're created by Rust after session is stored)
    const checkPendingState = async () => {
      if (hasCheckedPending.current) return;
      hasCheckedPending.current = true;

      // Secondary windows pull state immediately
      // Main window waits for RESTORE_START signal (to avoid restoring on normal startup)
      if (!isMainWindow) {
        await restoreFromPulledState();
      }
    };

    checkPendingState();

    // Listen for RESTORE_START signal (primarily for main window)
    // This is just a trigger — actual state is pulled, not passed in event
    const unlistenPromise = listen(
      HOT_EXIT_EVENTS.RESTORE_START,
      async () => {
        // Main window receives this signal and pulls its state
        if (isMainWindow) {
          await restoreFromPulledState();
        }
        // Secondary windows ignore this — they restore on mount
      }
    );

    return () => {
      void unlistenPromise.then((unlisten) => unlisten()).catch(() => {
        // Ignore cleanup errors
      });
    };
  }, []);
}


/**
 * Restore a window from its state (used by both event-driven and pull-based restore)
 */
async function restoreWindowState(windowLabel: string, windowState: WindowState): Promise<void> {
  // Restore UI state first (before tabs)
  restoreUiState(windowState);

  // Restore tabs
  await restoreTabs(windowLabel, windowState);
}

/**
 * Restore UI state (sidebar, view modes, etc.)
 */
function restoreUiState(windowState: WindowState): void {
  const { ui_state } = windowState;
  const uiStore = useUIStore.getState();
  const editorStore = useEditorStore.getState();

  // Validate sidebar_view_mode before setting
  const viewMode = (ui_state.sidebar_view_mode === 'files' || ui_state.sidebar_view_mode === 'outline')
    ? ui_state.sidebar_view_mode
    : 'files';

  // Restore sidebar state
  if (ui_state.sidebar_visible !== uiStore.sidebarVisible) {
    uiStore.toggleSidebar();
  }
  uiStore.setSidebarWidth(ui_state.sidebar_width);

  if (ui_state.outline_visible !== uiStore.outlineVisible) {
    uiStore.toggleOutline();
  }

  uiStore.setSidebarViewMode(viewMode);
  uiStore.setStatusBarVisible(ui_state.status_bar_visible);

  // Restore view modes
  if (ui_state.source_mode_enabled !== editorStore.sourceMode) {
    editorStore.toggleSourceMode();
  }
  if (ui_state.focus_mode_enabled !== editorStore.focusModeEnabled) {
    editorStore.toggleFocusMode();
  }
  if (ui_state.typewriter_mode_enabled !== editorStore.typewriterModeEnabled) {
    editorStore.toggleTypewriterMode();
  }
}

/**
 * Restore tabs from window state
 */
async function restoreTabs(windowLabel: string, windowState: WindowState): Promise<void> {
  const tabStore = useTabStore.getState();
  const documentStore = useDocumentStore.getState();

  // Clear existing tabs by removing the window (bypasses pin rules)
  const existingTabs = tabStore.getTabsByWindow(windowLabel);
  const historyStore = useUnifiedHistoryStore.getState();
  existingTabs.forEach((tab) => {
    documentStore.removeDocument(tab.id);
    // Also clear unified history to prevent memory leaks
    historyStore.clearDocument(tab.id);
  });

  // Remove window from tab store to clear all tabs at once
  if (existingTabs.length > 0) {
    tabStore.removeWindow(windowLabel);
  }

  // Build tab ID mapping: session tab ID -> new tab ID
  const tabIdMap = new Map<string, string>();

  // Restore each tab
  for (const tabState of windowState.tabs) {
    // Create tab (will auto-activate if first tab)
    const newTabId = tabStore.createTab(windowLabel, tabState.file_path);

    // Store mapping
    tabIdMap.set(tabState.id, newTabId);

    // Update tab metadata
    if (tabState.title) {
      tabStore.updateTabTitle(newTabId, tabState.title);
    }
    if (tabState.is_pinned) {
      tabStore.togglePin(windowLabel, newTabId);
    }

    // Restore document state
    await restoreDocumentState(newTabId, tabState, documentStore);
  }

  // Restore active tab using mapped ID
  if (windowState.active_tab_id) {
    const mappedActiveId = tabIdMap.get(windowState.active_tab_id);
    if (mappedActiveId) {
      tabStore.setActiveTab(windowLabel, mappedActiveId);
    } else {
      // Fallback to first tab if mapping not found
      const tabs = tabStore.getTabsByWindow(windowLabel);
      if (tabs.length > 0) {
        tabStore.setActiveTab(windowLabel, tabs[0].id);
      }
    }
  }
}

/**
 * Restore document state for a tab
 */
async function restoreDocumentState(
  tabId: string,
  tabState: import('./types').TabState,
  documentStore: ReturnType<typeof useDocumentStore.getState>
): Promise<void> {
  const { document: docState, file_path } = tabState;

  // Convert line ending format (validate and narrow type)
  const lineEnding = (
    docState.line_ending === '\n' ||
    docState.line_ending === '\r\n' ||
    docState.line_ending === 'unknown'
  )
    ? fromHotExitLineEnding(docState.line_ending)
    : ('unknown' as LineEnding);

  // Initialize document with saved content first
  documentStore.initDocument(tabId, docState.saved_content, file_path);

  // Load saved content with metadata
  documentStore.loadContent(tabId, docState.saved_content, file_path, {
    lineEnding,
  });

  // If dirty, apply current content (different from saved)
  if (docState.is_dirty) {
    documentStore.setContent(tabId, docState.content);
  }

  // Restore flags
  if (docState.is_missing) {
    documentStore.markMissing(tabId);
  }
  if (docState.is_divergent) {
    documentStore.markDivergent(tabId);
  }

  // Restore cursor info
  if (docState.cursor_info) {
    documentStore.setCursorInfo(tabId, {
      sourceLine: docState.cursor_info.source_line,
      wordAtCursor: docState.cursor_info.word_at_cursor,
      offsetInWord: docState.cursor_info.offset_in_word,
      nodeType: docState.cursor_info.node_type as import('@/types/cursorSync').NodeType,
      percentInLine: docState.cursor_info.percent_in_line,
      contextBefore: docState.cursor_info.context_before,
      contextAfter: docState.cursor_info.context_after,
      blockAnchor: docState.cursor_info.block_anchor as import('@/types/cursorSync').BlockAnchor | undefined,
    });
  }

  // Restore unified history (cross-mode undo/redo checkpoints)
  restoreUnifiedHistory(tabId, docState);
}

/**
 * Restore unified history checkpoints for a tab
 */
function restoreUnifiedHistory(
  tabId: string,
  docState: import('./types').DocumentState
): void {
  const undoHistory = docState.undo_history || [];
  const redoHistory = docState.redo_history || [];

  // Skip if no history to restore
  if (undoHistory.length === 0 && redoHistory.length === 0) {
    return;
  }

  // Convert checkpoints from hot exit format to store format
  const undoStack = undoHistory.map(fromHotExitCheckpoint);
  const redoStack = redoHistory.map(fromHotExitCheckpoint);

  // Directly set the history state for this document
  useUnifiedHistoryStore.setState((state) => ({
    documents: {
      ...state.documents,
      [tabId]: {
        undoStack,
        redoStack,
      },
    },
  }));

  console.log(
    `[HotExit] Restored unified history for tab '${tabId}': ${undoStack.length} undo, ${redoStack.length} redo checkpoints`
  );
}
