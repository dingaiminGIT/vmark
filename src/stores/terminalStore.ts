import { create } from "zustand";

// Terminal panel height constraints
const TERMINAL_MIN_HEIGHT = 100;
const TERMINAL_MAX_HEIGHT = 600;
const TERMINAL_DEFAULT_HEIGHT = 200;

export type MarkdownMode = "ansi" | "overlay" | "off";

interface TerminalState {
  visible: boolean;
  height: number;
  activeSessionId: string | null;
  markdownMode: MarkdownMode;
}

interface TerminalActions {
  toggle: () => void;
  setVisible: (visible: boolean) => void;
  setHeight: (height: number) => void;
  setActiveSessionId: (sessionId: string | null) => void;
  setMarkdownMode: (mode: MarkdownMode) => void;
}

export const useTerminalStore = create<TerminalState & TerminalActions>((set) => ({
  visible: false,
  height: TERMINAL_DEFAULT_HEIGHT,
  activeSessionId: null,
  markdownMode: "ansi",

  toggle: () => set((state) => ({ visible: !state.visible })),
  setVisible: (visible) => set({ visible }),
  setHeight: (height) =>
    set({
      height: Math.min(TERMINAL_MAX_HEIGHT, Math.max(TERMINAL_MIN_HEIGHT, height)),
    }),
  setActiveSessionId: (sessionId) => set({ activeSessionId: sessionId }),
  setMarkdownMode: (mode) => set({ markdownMode: mode }),
}));

// Export constants for use in resize hook
export { TERMINAL_MIN_HEIGHT, TERMINAL_MAX_HEIGHT };
