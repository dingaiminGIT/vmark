/**
 * Wiki Embed Popup Store
 *
 * Manages state for the wiki embed edit popup.
 */

import { create } from "zustand";
import type { AnchorRect } from "@/utils/popupPosition";

interface WikiEmbedPopupState {
  isOpen: boolean;
  anchorRect: AnchorRect | null;
  target: string;
  nodePos: number | null;
}

interface WikiEmbedPopupActions {
  openPopup: (rect: AnchorRect, target: string, pos: number) => void;
  closePopup: () => void;
  updateTarget: (target: string) => void;
}

type WikiEmbedPopupStore = WikiEmbedPopupState & WikiEmbedPopupActions;

const initialState: WikiEmbedPopupState = {
  isOpen: false,
  anchorRect: null,
  target: "",
  nodePos: null,
};

export const useWikiEmbedPopupStore = create<WikiEmbedPopupStore>((set) => ({
  ...initialState,

  openPopup: (rect, target, pos) =>
    set({
      isOpen: true,
      anchorRect: rect,
      target,
      nodePos: pos,
    }),

  closePopup: () => set(initialState),

  updateTarget: (target) => set({ target }),
}));
