/**
 * Inline Math Editing Store
 *
 * Coordinates editing state between multiple inline math NodeViews.
 * Prevents race conditions when clicking from one math to another.
 */

import { create } from "zustand";

/** Callback interface for NodeView to implement */
export interface InlineMathEditingCallbacks {
  /** Force exit: commit changes but don't reposition cursor */
  forceExit: () => void;
  /** Get the node position */
  getNodePos: () => number | undefined;
}

interface InlineMathEditingState {
  /** Position of the node currently being edited */
  editingNodePos: number | null;
  /** Reference to the active NodeView's callbacks */
  activeCallbacks: InlineMathEditingCallbacks | null;
}

interface InlineMathEditingActions {
  /**
   * Start editing a math node.
   * If another node is being edited, it will be force-exited first.
   */
  startEditing: (pos: number, callbacks: InlineMathEditingCallbacks) => void;

  /**
   * Stop editing. Called when exiting normally (blur, ESC, etc.)
   * Only clears if the given pos matches current editing pos.
   */
  stopEditing: (pos: number) => void;

  /**
   * Check if a specific position is being edited.
   */
  isEditingAt: (pos: number) => boolean;

  /**
   * Clear editing state (used when NodeView is destroyed).
   */
  clear: (pos: number) => void;
}

type InlineMathEditingStore = InlineMathEditingState & InlineMathEditingActions;

export const useInlineMathEditingStore = create<InlineMathEditingStore>((set, get) => ({
  editingNodePos: null,
  activeCallbacks: null,

  startEditing: (pos, callbacks) => {
    const { editingNodePos, activeCallbacks } = get();

    // If another node is being edited, force it to exit first
    if (editingNodePos !== null && editingNodePos !== pos && activeCallbacks) {
      activeCallbacks.forceExit();
    }

    set({
      editingNodePos: pos,
      activeCallbacks: callbacks,
    });
  },

  stopEditing: (pos) => {
    const { editingNodePos } = get();
    // Only clear if this is the currently editing node
    if (editingNodePos === pos) {
      set({
        editingNodePos: null,
        activeCallbacks: null,
      });
    }
  },

  isEditingAt: (pos) => {
    return get().editingNodePos === pos;
  },

  clear: (pos) => {
    const { editingNodePos } = get();
    if (editingNodePos === pos) {
      set({
        editingNodePos: null,
        activeCallbacks: null,
      });
    }
  },
}));
