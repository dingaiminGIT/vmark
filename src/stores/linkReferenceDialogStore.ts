/**
 * Link Reference Dialog Store
 *
 * Manages state for the reference link insertion dialog.
 * User provides identifier and URL to create a reference link
 * and its definition.
 */

import { create } from "zustand";

type OnInsertCallback = (identifier: string, url: string, title: string) => void;

interface LinkReferenceDialogState {
  isOpen: boolean;
  selectedText: string;
  onInsert: OnInsertCallback | null;
}

interface LinkReferenceDialogActions {
  openDialog: (selectedText: string, onInsert: OnInsertCallback) => void;
  closeDialog: () => void;
  insert: (identifier: string, url: string, title: string) => void;
}

type LinkReferenceDialogStore = LinkReferenceDialogState & LinkReferenceDialogActions;

const initialState: LinkReferenceDialogState = {
  isOpen: false,
  selectedText: "",
  onInsert: null,
};

export const useLinkReferenceDialogStore = create<LinkReferenceDialogStore>((set, get) => ({
  ...initialState,

  openDialog: (selectedText, onInsert) =>
    set({
      isOpen: true,
      selectedText,
      onInsert,
    }),

  closeDialog: () => set(initialState),

  insert: (identifier, url, title) => {
    const { onInsert } = get();
    // Reset state before callback to ensure cleanup even if callback throws
    set(initialState);
    if (onInsert) {
      onInsert(identifier, url, title);
    }
  },
}));
