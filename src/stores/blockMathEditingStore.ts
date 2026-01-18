/**
 * Block Math Editing Store
 *
 * Manages state for block math (latex/mermaid code block) editing in WYSIWYG mode.
 * Tracks which code block is being edited and stores original content for revert.
 */

import { create } from "zustand";

interface BlockMathEditingState {
  /** Position of code block currently being edited, or null if not editing */
  editingPos: number | null;
  /** Original content for ESC revert */
  originalContent: string | null;
}

interface BlockMathEditingActions {
  /** Enter editing mode for a code block */
  startEditing: (pos: number, content: string) => void;
  /** Exit editing mode (called after commit or revert) */
  exitEditing: () => void;
  /** Check if a specific position is being edited */
  isEditingAt: (pos: number) => boolean;
}

type BlockMathEditingStore = BlockMathEditingState & BlockMathEditingActions;

const initialState: BlockMathEditingState = {
  editingPos: null,
  originalContent: null,
};

export const useBlockMathEditingStore = create<BlockMathEditingStore>((set, get) => ({
  ...initialState,

  startEditing: (pos, content) =>
    set({
      editingPos: pos,
      originalContent: content,
    }),

  exitEditing: () => set(initialState),

  isEditingAt: (pos) => get().editingPos === pos,
}));
