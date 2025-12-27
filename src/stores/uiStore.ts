import { create } from "zustand";

interface UIState {
  settingsOpen: boolean;
  sidebarVisible: boolean;
  outlineVisible: boolean;
}

interface UIActions {
  openSettings: () => void;
  closeSettings: () => void;
  toggleSidebar: () => void;
  toggleOutline: () => void;
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  settingsOpen: false,
  sidebarVisible: false,
  outlineVisible: false,

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
  toggleOutline: () => set((state) => ({ outlineVisible: !state.outlineVisible })),
}));
