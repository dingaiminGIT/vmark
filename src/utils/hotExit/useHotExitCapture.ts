/**
 * Hot Exit Capture Hook
 *
 * Listens for capture requests from Rust coordinator and responds with
 * current window state (tabs, documents, UI state).
 */

import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useTabStore } from '@/stores/tabStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useUIStore } from '@/stores/uiStore';
import { useEditorStore } from '@/stores/editorStore';
import { useUnifiedHistoryStore } from '@/stores/unifiedHistoryStore';
import type { WindowState, TabState, CaptureResponse, HistoryCheckpoint } from './types';
import { HOT_EXIT_EVENTS } from './types';
import type { LineEnding as StoreLineEnding } from '@/utils/linebreakDetection';
import type { HistoryCheckpoint as StoreHistoryCheckpoint } from '@/stores/unifiedHistoryStore';

/**
 * Convert store line ending format to hot exit format
 */
function toHotExitLineEnding(lineEnding: StoreLineEnding): '\n' | '\r\n' | 'unknown' {
  switch (lineEnding) {
    case 'lf':
      return '\n';
    case 'crlf':
      return '\r\n';
    case 'unknown':
      return 'unknown';
  }
}

/**
 * Convert store history checkpoint to hot exit format
 */
function toHotExitCheckpoint(checkpoint: StoreHistoryCheckpoint): HistoryCheckpoint {
  return {
    markdown: checkpoint.markdown,
    mode: checkpoint.mode,
    cursor_info: checkpoint.cursorInfo
      ? {
          source_line: checkpoint.cursorInfo.sourceLine,
          word_at_cursor: checkpoint.cursorInfo.wordAtCursor,
          offset_in_word: checkpoint.cursorInfo.offsetInWord,
          node_type: checkpoint.cursorInfo.nodeType,
          percent_in_line: checkpoint.cursorInfo.percentInLine,
          context_before: checkpoint.cursorInfo.contextBefore,
          context_after: checkpoint.cursorInfo.contextAfter,
          block_anchor: checkpoint.cursorInfo.blockAnchor,
        }
      : null,
    timestamp: checkpoint.timestamp,
  };
}

export function useHotExitCapture() {
  useEffect(() => {
    const unlistenPromise = listen(HOT_EXIT_EVENTS.CAPTURE_REQUEST, async () => {
      // Get current window inside callback to ensure it's available
      const currentWindow = getCurrentWebviewWindow();
      const windowLabel = currentWindow.label;
      // Only the window with label "main" is the main window
      // doc-* windows are secondary windows even if doc-0
      const isMainWindow = windowLabel === 'main';

      try {
        const windowState = captureWindowState(windowLabel, isMainWindow);
        const response: CaptureResponse = {
          window_label: windowLabel,
          state: windowState,
        };

        // Emit response using window.emit() to ensure it reaches Rust app.listen()
        // (global emit() may not route to Rust properly in Tauri v2)
        try {
          await currentWindow.emit(HOT_EXIT_EVENTS.CAPTURE_RESPONSE, response);
        } catch (emitError) {
          console.error('[HotExit] Failed to emit capture response:', emitError);
        }
      } catch (error) {
        console.error('[HotExit] Failed to capture window state:', error);

        // Still respond with partial state to avoid blocking coordinator
        const fallbackState: WindowState = {
          window_label: windowLabel,
          is_main_window: isMainWindow,
          active_tab_id: null,
          tabs: [],
          ui_state: getUiState(),
          geometry: null,
        };
        const response: CaptureResponse = {
          window_label: windowLabel,
          state: fallbackState,
        };

        // Best-effort emit for fallback using window.emit()
        void currentWindow.emit(HOT_EXIT_EVENTS.CAPTURE_RESPONSE, response).catch((e) => {
          console.error('[HotExit] Failed to emit fallback response:', e);
        });
      }
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten()).catch(() => {
        // Ignore cleanup errors
      });
    };
  }, []);
}

/**
 * Capture complete window state
 */
function captureWindowState(windowLabel: string, isMainWindow: boolean): WindowState {
  const tabStore = useTabStore.getState();
  const documentStore = useDocumentStore.getState();
  const historyStore = useUnifiedHistoryStore.getState();

  // Get tabs for this window
  const windowTabs = tabStore.getTabsByWindow(windowLabel);

  const tabs: TabState[] = windowTabs.map((tab) => {
    const doc = documentStore.getDocument(tab.id);
    const docHistory = historyStore.documents[tab.id];

    // Capture undo/redo history for this tab
    const undoHistory = docHistory?.undoStack.map(toHotExitCheckpoint) || [];
    const redoHistory = docHistory?.redoStack.map(toHotExitCheckpoint) || [];

    return {
      id: tab.id,
      file_path: tab.filePath,
      title: tab.title,
      is_pinned: tab.isPinned,
      document: doc
        ? {
            content: doc.content,
            saved_content: doc.savedContent,
            is_dirty: doc.isDirty,
            is_missing: doc.isMissing,
            is_divergent: doc.isDivergent,
            line_ending: toHotExitLineEnding(doc.lineEnding),
            cursor_info: doc.cursorInfo
              ? {
                  source_line: doc.cursorInfo.sourceLine,
                  word_at_cursor: doc.cursorInfo.wordAtCursor,
                  offset_in_word: doc.cursorInfo.offsetInWord,
                  node_type: doc.cursorInfo.nodeType,
                  percent_in_line: doc.cursorInfo.percentInLine,
                  context_before: doc.cursorInfo.contextBefore,
                  context_after: doc.cursorInfo.contextAfter,
                  block_anchor: doc.cursorInfo.blockAnchor,
                }
              : null,
            last_modified_timestamp: doc.lastAutoSave,
            is_untitled: !tab.filePath,
            untitled_number: tab.filePath ? null : extractUntitledNumber(tab.title),
            undo_history: undoHistory,
            redo_history: redoHistory,
          }
        : {
        // Fallback if document not found
        content: '',
        saved_content: '',
        is_dirty: false,
        is_missing: false,
        is_divergent: false,
        line_ending: '\n',
        cursor_info: null,
        last_modified_timestamp: null,
        is_untitled: !tab.filePath,
        untitled_number: tab.filePath ? null : extractUntitledNumber(tab.title),
        undo_history: [],
        redo_history: [],
      },
    };
  });

  const activeTab = tabStore.getActiveTab(windowLabel);

  return {
    window_label: windowLabel,
    is_main_window: isMainWindow,
    active_tab_id: activeTab?.id || null,
    tabs,
    ui_state: getUiState(),
    geometry: null, // Window geometry capture not yet implemented
  };
}

/**
 * Extract untitled number from tab title like "Untitled-5"
 */
function extractUntitledNumber(title: string): number | null {
  const match = title.match(/^Untitled-(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Gather UI state from stores
 */
function getUiState() {
  const uiStore = useUIStore.getState();
  const editorStore = useEditorStore.getState();

  return {
    sidebar_visible: uiStore.sidebarVisible,
    sidebar_width: uiStore.sidebarWidth,
    outline_visible: uiStore.outlineVisible,
    sidebar_view_mode: uiStore.sidebarViewMode,
    status_bar_visible: uiStore.statusBarVisible,
    source_mode_enabled: editorStore.sourceMode,
    focus_mode_enabled: editorStore.focusModeEnabled,
    typewriter_mode_enabled: editorStore.typewriterModeEnabled,
  };
}
