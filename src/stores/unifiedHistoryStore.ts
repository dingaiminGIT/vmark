/**
 * Unified History Store
 *
 * Manages cross-mode undo/redo by storing checkpoints when switching
 * between WYSIWYG and Source modes. This allows users to undo past
 * mode switches seamlessly.
 *
 * Architecture:
 * - Each editor (Tiptap/CodeMirror) has its own native history
 * - When switching modes, we create a "checkpoint" with the current markdown
 * - When native history is exhausted, we restore from the checkpoint
 * - This may trigger a mode switch to the previous mode
 */

import { create } from "zustand";
import type { CursorInfo } from "@/types/cursorSync";

export interface HistoryCheckpoint {
  /** The markdown content at this checkpoint */
  markdown: string;
  /** Which mode was active when this checkpoint was created */
  mode: "source" | "wysiwyg";
  /** Cursor position for restoration */
  cursorInfo: CursorInfo | null;
  /** Timestamp for debugging */
  timestamp: number;
}

interface UnifiedHistoryState {
  /** Stack of undo checkpoints (most recent last) */
  undoStack: HistoryCheckpoint[];
  /** Stack of redo checkpoints (most recent last) */
  redoStack: HistoryCheckpoint[];
  /** Maximum number of checkpoints to keep */
  maxCheckpoints: number;
  /** Whether we're currently restoring from a checkpoint (prevents re-checkpointing) */
  isRestoring: boolean;
}

interface UnifiedHistoryActions {
  /**
   * Create a checkpoint before switching modes.
   * Called when user toggles between Source and WYSIWYG.
   */
  createCheckpoint: (checkpoint: Omit<HistoryCheckpoint, "timestamp">) => void;

  /**
   * Pop the most recent checkpoint for undo.
   * Returns null if no checkpoints available.
   */
  popUndo: () => HistoryCheckpoint | null;

  /**
   * Pop the most recent checkpoint for redo.
   * Returns null if no checkpoints available.
   */
  popRedo: () => HistoryCheckpoint | null;

  /**
   * Push current state to redo stack (called when undoing to a checkpoint).
   */
  pushRedo: (checkpoint: Omit<HistoryCheckpoint, "timestamp">) => void;

  /**
   * Clear redo stack (called when user makes a new edit after undoing).
   */
  clearRedo: () => void;

  /**
   * Check if there's a checkpoint available for undo.
   */
  canUndoCheckpoint: () => boolean;

  /**
   * Check if there's a checkpoint available for redo.
   */
  canRedoCheckpoint: () => boolean;

  /**
   * Get the mode of the next undo checkpoint (for UI hints).
   */
  getNextUndoMode: () => "source" | "wysiwyg" | null;

  /**
   * Get the mode of the next redo checkpoint (for UI hints).
   */
  getNextRedoMode: () => "source" | "wysiwyg" | null;

  /**
   * Set restoring flag (prevents checkpoint creation during restore).
   */
  setRestoring: (value: boolean) => void;

  /**
   * Clear all history (called on document close or new document).
   */
  clear: () => void;
}

const MAX_CHECKPOINTS = 50;

export const useUnifiedHistoryStore = create<UnifiedHistoryState & UnifiedHistoryActions>(
  (set, get) => ({
    undoStack: [],
    redoStack: [],
    maxCheckpoints: MAX_CHECKPOINTS,
    isRestoring: false,

    createCheckpoint: (checkpoint) => {
      // Don't create checkpoint while restoring
      if (get().isRestoring) return;

      const newCheckpoint: HistoryCheckpoint = {
        ...checkpoint,
        timestamp: Date.now(),
      };

      set((state) => {
        const newStack = [...state.undoStack, newCheckpoint];
        // Trim to max size
        if (newStack.length > state.maxCheckpoints) {
          newStack.shift();
        }
        return {
          undoStack: newStack,
          // Clear redo on new checkpoint (new branch of history)
          redoStack: [],
        };
      });
    },

    popUndo: () => {
      const { undoStack } = get();
      if (undoStack.length === 0) return null;

      const checkpoint = undoStack[undoStack.length - 1];
      set((state) => ({
        undoStack: state.undoStack.slice(0, -1),
      }));
      return checkpoint;
    },

    popRedo: () => {
      const { redoStack } = get();
      if (redoStack.length === 0) return null;

      const checkpoint = redoStack[redoStack.length - 1];
      set((state) => ({
        redoStack: state.redoStack.slice(0, -1),
      }));
      return checkpoint;
    },

    pushRedo: (checkpoint) => {
      const newCheckpoint: HistoryCheckpoint = {
        ...checkpoint,
        timestamp: Date.now(),
      };

      set((state) => {
        const newStack = [...state.redoStack, newCheckpoint];
        if (newStack.length > state.maxCheckpoints) {
          newStack.shift();
        }
        return { redoStack: newStack };
      });
    },

    clearRedo: () => {
      set({ redoStack: [] });
    },

    canUndoCheckpoint: () => get().undoStack.length > 0,

    canRedoCheckpoint: () => get().redoStack.length > 0,

    getNextUndoMode: () => {
      const { undoStack } = get();
      if (undoStack.length === 0) return null;
      return undoStack[undoStack.length - 1].mode;
    },

    getNextRedoMode: () => {
      const { redoStack } = get();
      if (redoStack.length === 0) return null;
      return redoStack[redoStack.length - 1].mode;
    },

    setRestoring: (value) => {
      set({ isRestoring: value });
    },

    clear: () => {
      set({ undoStack: [], redoStack: [], isRestoring: false });
    },
  })
);
