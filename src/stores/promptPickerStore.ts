/**
 * Prompt Picker Store
 *
 * Minimal open/close state for the AI prompt picker overlay.
 */

import { create } from "zustand";
import type { PromptScope } from "@/types/aiPrompts";

interface PromptPickerState {
  isOpen: boolean;
  filterScope: PromptScope | null;
}

interface PromptPickerActions {
  openPicker(options?: { filterScope?: PromptScope }): void;
  closePicker(): void;
}

const initialState: PromptPickerState = {
  isOpen: false,
  filterScope: null,
};

export const usePromptPickerStore = create<
  PromptPickerState & PromptPickerActions
>((set) => ({
  ...initialState,

  openPicker: (options) =>
    set({
      isOpen: true,
      filterScope: options?.filterScope ?? null,
    }),

  closePicker: () => set(initialState),
}));
