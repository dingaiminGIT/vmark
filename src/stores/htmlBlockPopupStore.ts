/**
 * HTML Block Popup Store
 *
 * Manages state for the HTML inline/block edit popup.
 */

import { create } from "zustand";
import type { AnchorRect } from "@/utils/popupPosition";

interface HtmlBlockPopupState {
  isOpen: boolean;
  anchorRect: AnchorRect | null;
  html: string;
  nodePos: number | null;
}

interface HtmlBlockPopupActions {
  openPopup: (rect: AnchorRect, html: string, pos: number) => void;
  closePopup: () => void;
  updateHtml: (html: string) => void;
}

type HtmlBlockPopupStore = HtmlBlockPopupState & HtmlBlockPopupActions;

const initialState: HtmlBlockPopupState = {
  isOpen: false,
  anchorRect: null,
  html: "",
  nodePos: null,
};

export const useHtmlBlockPopupStore = create<HtmlBlockPopupStore>((set) => ({
  ...initialState,

  openPopup: (rect, html, pos) =>
    set({
      isOpen: true,
      anchorRect: rect,
      html,
      nodePos: pos,
    }),

  closePopup: () => set(initialState),

  updateHtml: (html) => set({ html }),
}));
