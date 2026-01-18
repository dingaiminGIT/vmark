import { create } from "zustand";

export type SidebarViewMode = "files" | "outline" | "history";

// Sidebar width constraints
const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 480;
const SIDEBAR_DEFAULT_WIDTH = 260;

interface UIState {
  settingsOpen: boolean;
  sidebarVisible: boolean;
  sidebarWidth: number;
  outlineVisible: boolean;
  sidebarViewMode: SidebarViewMode;
  activeHeadingLine: number | null; // Current heading line for outline highlight
  statusBarVisible: boolean; // Simple toggle for status bar visibility (Cmd+J)
  universalToolbarVisible: boolean; // Universal formatting toolbar (shortcut configurable)
  universalToolbarHasFocus: boolean; // Keyboard focus is inside the universal toolbar
  lastFocusedToolbarIndex: number; // Last focused button index in universal toolbar
}

interface UIActions {
  openSettings: () => void;
  closeSettings: () => void;
  toggleSidebar: () => void;
  toggleOutline: () => void;
  setSidebarViewMode: (mode: SidebarViewMode) => void;
  showSidebarWithView: (mode: SidebarViewMode) => void;
  setActiveHeadingLine: (line: number | null) => void;
  setSidebarWidth: (width: number) => void;
  setStatusBarVisible: (visible: boolean) => void;
  toggleUniversalToolbar: () => void;
  setUniversalToolbarVisible: (visible: boolean) => void;
  setUniversalToolbarHasFocus: (hasFocus: boolean) => void;
  setLastFocusedToolbarIndex: (index: number) => void;
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  settingsOpen: false,
  sidebarVisible: false,
  sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
  outlineVisible: false,
  sidebarViewMode: "outline",
  activeHeadingLine: null,
  statusBarVisible: true, // Default to visible
  universalToolbarVisible: false,
  universalToolbarHasFocus: false,
  lastFocusedToolbarIndex: 0,

  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
  toggleOutline: () => set((state) => ({ outlineVisible: !state.outlineVisible })),
  setSidebarViewMode: (mode) => set({ sidebarViewMode: mode }),
  showSidebarWithView: (mode) => set({ sidebarVisible: true, sidebarViewMode: mode }),
  setActiveHeadingLine: (line) => set({ activeHeadingLine: line }),
  setSidebarWidth: (width) => set({
    sidebarWidth: Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)),
  }),
  setStatusBarVisible: (visible) => set({ statusBarVisible: visible }),
  toggleUniversalToolbar: () =>
    set((state) => ({
      universalToolbarVisible: !state.universalToolbarVisible,
      universalToolbarHasFocus: !state.universalToolbarVisible,
    })),
  setUniversalToolbarVisible: (visible) =>
    set((state) => ({
      universalToolbarVisible: visible,
      universalToolbarHasFocus: visible ? state.universalToolbarHasFocus : false,
    })),
  setUniversalToolbarHasFocus: (hasFocus) => set({ universalToolbarHasFocus: hasFocus }),
  setLastFocusedToolbarIndex: (index) => set({ lastFocusedToolbarIndex: index }),
}));
