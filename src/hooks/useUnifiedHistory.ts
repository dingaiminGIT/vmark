/**
 * Unified History Hook
 *
 * Provides cross-mode undo/redo functionality by:
 * 1. Creating checkpoints when switching modes
 * 2. Intercepting undo/redo when native history is exhausted
 * 3. Restoring to checkpoints (potentially switching modes)
 */

import { useCallback } from "react";
import { undo, redo, undoDepth, redoDepth } from "@codemirror/commands";
import { useUnifiedHistoryStore } from "@/stores/unifiedHistoryStore";
import { useEditorStore } from "@/stores/editorStore";
import { useDocumentStore } from "@/stores/documentStore";
import { useTabStore } from "@/stores/tabStore";
import { useTiptapEditorStore } from "@/stores/tiptapEditorStore";
import { useActiveEditorStore } from "@/stores/activeEditorStore";
import { useWindowLabel } from "@/contexts/WindowContext";

/**
 * Toggle source mode with checkpoint creation.
 * Use this instead of direct toggleSourceMode() to maintain history.
 *
 * @param windowLabel - The window label for multi-window support
 */
export function toggleSourceModeWithCheckpoint(windowLabel: string): void {
  const editorStore = useEditorStore.getState();
  const documentStore = useDocumentStore.getState();
  const tabStore = useTabStore.getState();
  const historyStore = useUnifiedHistoryStore.getState();

  const tabId = tabStore.activeTabId[windowLabel];
  if (!tabId) {
    // Fallback: just toggle without checkpoint if no tab
    editorStore.toggleSourceMode();
    return;
  }

  const doc = documentStore.getDocument(tabId);
  if (!doc) {
    editorStore.toggleSourceMode();
    return;
  }

  const currentMode = editorStore.sourceMode ? "source" : "wysiwyg";
  const cursorInfo = doc.cursorInfo ?? null;

  // Create checkpoint with current state before switching (per-document)
  historyStore.createCheckpoint(tabId, {
    markdown: doc.content,
    mode: currentMode,
    cursorInfo,
  });

  // Now toggle the mode
  editorStore.toggleSourceMode();
}

/**
 * Hook version of toggleSourceModeWithCheckpoint for React components.
 */
export function useModeSwitchWithCheckpoint() {
  const windowLabel = useWindowLabel();
  return useCallback(() => {
    toggleSourceModeWithCheckpoint(windowLabel);
  }, [windowLabel]);
}

/**
 * Check if native undo is available in the current editor.
 */
export function canNativeUndo(): boolean {
  const sourceMode = useEditorStore.getState().sourceMode;

  if (sourceMode) {
    const view = useActiveEditorStore.getState().activeSourceView;
    if (!view) return false;
    return undoDepth(view.state) > 0;
  } else {
    const editor = useTiptapEditorStore.getState().editor;
    if (!editor) return false;
    return editor.can().undo();
  }
}

/**
 * Check if native redo is available in the current editor.
 */
export function canNativeRedo(): boolean {
  const sourceMode = useEditorStore.getState().sourceMode;

  if (sourceMode) {
    const view = useActiveEditorStore.getState().activeSourceView;
    if (!view) return false;
    return redoDepth(view.state) > 0;
  } else {
    const editor = useTiptapEditorStore.getState().editor;
    if (!editor) return false;
    return editor.can().redo();
  }
}

/**
 * Perform native undo in the current editor.
 * Returns true if undo was performed.
 */
export function doNativeUndo(): boolean {
  const sourceMode = useEditorStore.getState().sourceMode;

  if (sourceMode) {
    const view = useActiveEditorStore.getState().activeSourceView;
    if (!view) return false;
    if (undoDepth(view.state) === 0) return false;
    undo(view);
    return true;
  } else {
    const editor = useTiptapEditorStore.getState().editor;
    if (!editor) return false;
    if (!editor.can().undo()) return false;
    editor.commands.undo();
    return true;
  }
}

/**
 * Perform native redo in the current editor.
 * Returns true if redo was performed.
 */
export function doNativeRedo(): boolean {
  const sourceMode = useEditorStore.getState().sourceMode;

  if (sourceMode) {
    const view = useActiveEditorStore.getState().activeSourceView;
    if (!view) return false;
    if (redoDepth(view.state) === 0) return false;
    redo(view);
    return true;
  } else {
    const editor = useTiptapEditorStore.getState().editor;
    if (!editor) return false;
    if (!editor.can().redo()) return false;
    editor.commands.redo();
    return true;
  }
}

/**
 * Unified undo that works across mode switches.
 * 1. Try native undo first
 * 2. If native history exhausted, restore from checkpoint
 * 3. May trigger mode switch if checkpoint is from different mode
 */
export function useUnifiedUndo() {
  const windowLabel = useWindowLabel();

  return useCallback(() => {
    const historyStore = useUnifiedHistoryStore.getState();
    const editorStore = useEditorStore.getState();
    const documentStore = useDocumentStore.getState();
    const tabStore = useTabStore.getState();

    const tabId = tabStore.activeTabId[windowLabel];
    if (!tabId) return;

    // First, try native undo
    if (canNativeUndo()) {
      doNativeUndo();
      // Clear redo checkpoints when doing native undo
      // (user is making a new history branch within the mode)
      return;
    }

    // Native undo exhausted, check for checkpoint (per-document)
    if (!historyStore.canUndoCheckpoint(tabId)) {
      // Nothing to undo
      return;
    }

    const doc = documentStore.getDocument(tabId);
    if (!doc) return;

    // Save current state to redo stack before restoring checkpoint (per-document)
    const currentMode = editorStore.sourceMode ? "source" : "wysiwyg";
    historyStore.pushRedo(tabId, {
      markdown: doc.content,
      mode: currentMode,
      cursorInfo: doc.cursorInfo ?? null,
    });

    // Pop checkpoint (per-document)
    const checkpoint = historyStore.popUndo(tabId);
    if (!checkpoint) return;

    // Restore content
    historyStore.setRestoring(true);

    // Set content in document store
    documentStore.setContent(tabId, checkpoint.markdown);

    // Restore cursor info
    if (checkpoint.cursorInfo) {
      documentStore.setCursorInfo(tabId, checkpoint.cursorInfo);
    }

    // Switch mode if needed
    if (checkpoint.mode !== currentMode) {
      editorStore.toggleSourceMode();
    }

    // Small delay to let the editor update, then clear restoring flag
    requestAnimationFrame(() => {
      historyStore.setRestoring(false);
    });
  }, [windowLabel]);
}

/**
 * Unified redo that works across mode switches.
 */
export function useUnifiedRedo() {
  const windowLabel = useWindowLabel();

  return useCallback(() => {
    const historyStore = useUnifiedHistoryStore.getState();
    const editorStore = useEditorStore.getState();
    const documentStore = useDocumentStore.getState();
    const tabStore = useTabStore.getState();

    const tabId = tabStore.activeTabId[windowLabel];
    if (!tabId) return;

    // First, try native redo
    if (canNativeRedo()) {
      doNativeRedo();
      return;
    }

    // Native redo exhausted, check for checkpoint (per-document)
    if (!historyStore.canRedoCheckpoint(tabId)) {
      // Nothing to redo
      return;
    }

    const doc = documentStore.getDocument(tabId);
    if (!doc) return;

    // Save current state to undo stack before restoring (per-document)
    const currentMode = editorStore.sourceMode ? "source" : "wysiwyg";
    historyStore.createCheckpoint(tabId, {
      markdown: doc.content,
      mode: currentMode,
      cursorInfo: doc.cursorInfo ?? null,
    });

    // Pop redo checkpoint (per-document)
    const checkpoint = historyStore.popRedo(tabId);
    if (!checkpoint) return;

    // Restore content
    historyStore.setRestoring(true);

    // Set content in document store
    documentStore.setContent(tabId, checkpoint.markdown);

    // Restore cursor info
    if (checkpoint.cursorInfo) {
      documentStore.setCursorInfo(tabId, checkpoint.cursorInfo);
    }

    // Switch mode if needed
    if (checkpoint.mode !== currentMode) {
      editorStore.toggleSourceMode();
    }

    // Clear restoring flag
    requestAnimationFrame(() => {
      historyStore.setRestoring(false);
    });
  }, [windowLabel]);
}

/**
 * Clear unified history for a specific document (call when tab closes).
 */
export function clearDocumentHistory(tabId: string): void {
  useUnifiedHistoryStore.getState().clearDocument(tabId);
}

/**
 * Clear all unified history (call on app reset).
 */
export function clearAllHistory(): void {
  useUnifiedHistoryStore.getState().clearAll();
}

/**
 * Perform unified undo (can be called from any context).
 * Returns true if any undo action was performed.
 */
export function performUnifiedUndo(windowLabel: string): boolean {
  const historyStore = useUnifiedHistoryStore.getState();
  const editorStore = useEditorStore.getState();
  const documentStore = useDocumentStore.getState();
  const tabStore = useTabStore.getState();

  const tabId = tabStore.activeTabId[windowLabel];
  if (!tabId) return false;

  // First, try native undo
  if (canNativeUndo()) {
    doNativeUndo();
    return true;
  }

  // Native undo exhausted, check for checkpoint (per-document)
  if (!historyStore.canUndoCheckpoint(tabId)) {
    return false;
  }

  const doc = documentStore.getDocument(tabId);
  if (!doc) return false;

  // Save current state to redo stack before restoring checkpoint (per-document)
  const currentMode = editorStore.sourceMode ? "source" : "wysiwyg";
  historyStore.pushRedo(tabId, {
    markdown: doc.content,
    mode: currentMode,
    cursorInfo: doc.cursorInfo ?? null,
  });

  // Pop checkpoint (per-document)
  const checkpoint = historyStore.popUndo(tabId);
  if (!checkpoint) return false;

  // Restore content
  historyStore.setRestoring(true);
  documentStore.setContent(tabId, checkpoint.markdown);

  if (checkpoint.cursorInfo) {
    documentStore.setCursorInfo(tabId, checkpoint.cursorInfo);
  }

  // Switch mode if needed
  if (checkpoint.mode !== currentMode) {
    editorStore.toggleSourceMode();
  }

  requestAnimationFrame(() => {
    historyStore.setRestoring(false);
  });

  return true;
}

/**
 * Perform unified redo (can be called from any context).
 * Returns true if any redo action was performed.
 */
export function performUnifiedRedo(windowLabel: string): boolean {
  const historyStore = useUnifiedHistoryStore.getState();
  const editorStore = useEditorStore.getState();
  const documentStore = useDocumentStore.getState();
  const tabStore = useTabStore.getState();

  const tabId = tabStore.activeTabId[windowLabel];
  if (!tabId) return false;

  // First, try native redo
  if (canNativeRedo()) {
    doNativeRedo();
    return true;
  }

  // Native redo exhausted, check for checkpoint (per-document)
  if (!historyStore.canRedoCheckpoint(tabId)) {
    return false;
  }

  const doc = documentStore.getDocument(tabId);
  if (!doc) return false;

  // Save current state to undo stack before restoring (per-document)
  const currentMode = editorStore.sourceMode ? "source" : "wysiwyg";
  historyStore.createCheckpoint(tabId, {
    markdown: doc.content,
    mode: currentMode,
    cursorInfo: doc.cursorInfo ?? null,
  });

  // Pop redo checkpoint (per-document)
  const checkpoint = historyStore.popRedo(tabId);
  if (!checkpoint) return false;

  // Restore content
  historyStore.setRestoring(true);
  documentStore.setContent(tabId, checkpoint.markdown);

  if (checkpoint.cursorInfo) {
    documentStore.setCursorInfo(tabId, checkpoint.cursorInfo);
  }

  // Switch mode if needed
  if (checkpoint.mode !== currentMode) {
    editorStore.toggleSourceMode();
  }

  requestAnimationFrame(() => {
    historyStore.setRestoring(false);
  });

  return true;
}
