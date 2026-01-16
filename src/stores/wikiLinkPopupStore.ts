/**
 * Wiki Link Popup Store
 *
 * Manages state for the wiki link edit popup.
 */

import { create } from "zustand";
import type { AnchorRect } from "@/utils/popupPosition";

interface WikiLinkPopupState {
  isOpen: boolean;
  anchorRect: AnchorRect | null;
  target: string;
  alias: string;
  nodePos: number | null;
}

interface WikiLinkPopupActions {
  openPopup: (rect: AnchorRect, target: string, alias: string, pos: number) => void;
  closePopup: () => void;
  updateTarget: (target: string) => void;
  updateAlias: (alias: string) => void;
}

type WikiLinkPopupStore = WikiLinkPopupState & WikiLinkPopupActions;

const initialState: WikiLinkPopupState = {
  isOpen: false,
  anchorRect: null,
  target: "",
  alias: "",
  nodePos: null,
};

export const useWikiLinkPopupStore = create<WikiLinkPopupStore>((set) => ({
  ...initialState,

  openPopup: (rect, target, alias, pos) =>
    set({
      isOpen: true,
      anchorRect: rect,
      target,
      alias,
      nodePos: pos,
    }),

  closePopup: () => set(initialState),

  updateTarget: (target) => set({ target }),

  updateAlias: (alias) => set({ alias }),
}));
