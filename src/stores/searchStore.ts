import { create } from "zustand";

interface SearchState {
  isOpen: boolean;
  showReplace: boolean;
  query: string;
  replaceText: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  matchCount: number;
  currentIndex: number;
}

interface SearchActions {
  openFind: () => void;
  openReplace: () => void;
  close: () => void;
  setQuery: (query: string) => void;
  setReplaceText: (text: string) => void;
  toggleCaseSensitive: () => void;
  toggleWholeWord: () => void;
  setMatches: (count: number, currentIndex: number) => void;
  findNext: () => void;
  findPrevious: () => void;
  replaceCurrent: () => void;
  replaceAll: () => void;
}

const initialState: SearchState = {
  isOpen: false,
  showReplace: false,
  query: "",
  replaceText: "",
  caseSensitive: false,
  wholeWord: false,
  matchCount: 0,
  currentIndex: -1,
};

export const useSearchStore = create<SearchState & SearchActions>((set, get) => ({
  ...initialState,

  openFind: () => set({ isOpen: true, showReplace: false }),

  openReplace: () => set({ isOpen: true, showReplace: true }),

  close: () => set({ isOpen: false }),

  setQuery: (query) => set({ query, currentIndex: -1 }),

  setReplaceText: (replaceText) => set({ replaceText }),

  toggleCaseSensitive: () =>
    set((state) => ({ caseSensitive: !state.caseSensitive, currentIndex: -1 })),

  toggleWholeWord: () =>
    set((state) => ({ wholeWord: !state.wholeWord, currentIndex: -1 })),

  setMatches: (matchCount, currentIndex) => set({ matchCount, currentIndex }),

  findNext: () => {
    const { matchCount, currentIndex } = get();
    if (matchCount === 0) return;
    const next = currentIndex + 1 >= matchCount ? 0 : currentIndex + 1;
    set({ currentIndex: next });
  },

  findPrevious: () => {
    const { matchCount, currentIndex } = get();
    if (matchCount === 0) return;
    const prev = currentIndex - 1 < 0 ? matchCount - 1 : currentIndex - 1;
    set({ currentIndex: prev });
  },

  replaceCurrent: () => {
    // Actual replacement is handled by editor adapters
    // This just signals the intent - editors listen to store changes
  },

  replaceAll: () => {
    // Actual replacement is handled by editor adapters
    // This just signals the intent - editors listen to store changes
  },
}));
