import { describe, it, expect, beforeEach } from "vitest";
import { useSpellCheckStore } from "./spellCheckStore";

function resetSpellCheckStore() {
  // Clear the internal Set by calling clearIgnored first
  useSpellCheckStore.getState().clearIgnored();
  // Then reset all state
  useSpellCheckStore.setState({
    isPopupOpen: false,
    popupPosition: null,
    currentWord: null,
    suggestions: [],
    ignoredWords: [],
  });
}

beforeEach(resetSpellCheckStore);

describe("spellCheckStore", () => {
  describe("popup state", () => {
    it("opens popup with all state fields", () => {
      const store = useSpellCheckStore.getState();
      const position = { top: 100, left: 200 };
      const word = { from: 10, to: 15, text: "tset" };
      const suggestions = ["test", "set", "best"];

      store.openPopup(position, word, suggestions);

      const state = useSpellCheckStore.getState();
      expect(state.isPopupOpen).toBe(true);
      expect(state.popupPosition).toEqual(position);
      expect(state.currentWord).toEqual(word);
      expect(state.suggestions).toEqual(suggestions);
    });

    it("closes popup and resets state", () => {
      const store = useSpellCheckStore.getState();

      // First open the popup
      store.openPopup(
        { top: 100, left: 200 },
        { from: 10, to: 15, text: "tset" },
        ["test", "set"]
      );

      // Now close it
      store.closePopup();

      const state = useSpellCheckStore.getState();
      expect(state.isPopupOpen).toBe(false);
      expect(state.popupPosition).toBeNull();
      expect(state.currentWord).toBeNull();
      expect(state.suggestions).toEqual([]);
    });

    it("can re-open popup after closing", () => {
      const store = useSpellCheckStore.getState();

      store.openPopup({ top: 100, left: 200 }, { from: 10, to: 15, text: "word1" }, ["suggestion1"]);
      store.closePopup();
      store.openPopup({ top: 300, left: 400 }, { from: 20, to: 25, text: "word2" }, ["suggestion2"]);

      const state = useSpellCheckStore.getState();
      expect(state.isPopupOpen).toBe(true);
      expect(state.popupPosition).toEqual({ top: 300, left: 400 });
      expect(state.currentWord?.text).toBe("word2");
    });
  });

  describe("ignored words - addToIgnored", () => {
    it("adds word to ignored list", () => {
      const store = useSpellCheckStore.getState();

      store.addToIgnored("customword");

      const state = useSpellCheckStore.getState();
      expect(state.ignoredWords).toContain("customword");
    });

    it("converts word to lowercase", () => {
      const store = useSpellCheckStore.getState();

      store.addToIgnored("CustomWord");

      const state = useSpellCheckStore.getState();
      expect(state.ignoredWords).toContain("customword");
      expect(state.ignoredWords).not.toContain("CustomWord");
    });

    it("prevents duplicates", () => {
      const store = useSpellCheckStore.getState();

      store.addToIgnored("word");
      store.addToIgnored("word");
      store.addToIgnored("WORD");

      const state = useSpellCheckStore.getState();
      expect(state.ignoredWords.filter((w) => w === "word")).toHaveLength(1);
    });

    it("adds multiple different words", () => {
      const store = useSpellCheckStore.getState();

      store.addToIgnored("apple");
      store.addToIgnored("banana");
      store.addToIgnored("cherry");

      const state = useSpellCheckStore.getState();
      expect(state.ignoredWords).toEqual(["apple", "banana", "cherry"]);
    });
  });

  describe("ignored words - removeFromIgnored", () => {
    it("removes word from ignored list", () => {
      const store = useSpellCheckStore.getState();

      store.addToIgnored("word");
      store.removeFromIgnored("word");

      const state = useSpellCheckStore.getState();
      expect(state.ignoredWords).not.toContain("word");
    });

    it("handles case-insensitive removal", () => {
      const store = useSpellCheckStore.getState();

      store.addToIgnored("Word");
      store.removeFromIgnored("WORD");

      const state = useSpellCheckStore.getState();
      expect(state.ignoredWords).not.toContain("word");
    });

    it("does nothing if word not in list", () => {
      const store = useSpellCheckStore.getState();

      store.addToIgnored("apple");
      store.removeFromIgnored("banana");

      const state = useSpellCheckStore.getState();
      expect(state.ignoredWords).toEqual(["apple"]);
    });

    it("only removes the specified word", () => {
      const store = useSpellCheckStore.getState();

      store.addToIgnored("apple");
      store.addToIgnored("banana");
      store.addToIgnored("cherry");
      store.removeFromIgnored("banana");

      const state = useSpellCheckStore.getState();
      expect(state.ignoredWords).toEqual(["apple", "cherry"]);
    });
  });

  describe("ignored words - isIgnored", () => {
    it("returns true for ignored words", () => {
      const store = useSpellCheckStore.getState();

      store.addToIgnored("customword");

      expect(store.isIgnored("customword")).toBe(true);
    });

    it("is case-insensitive", () => {
      const store = useSpellCheckStore.getState();

      store.addToIgnored("Word");

      expect(store.isIgnored("word")).toBe(true);
      expect(store.isIgnored("WORD")).toBe(true);
      expect(store.isIgnored("WoRd")).toBe(true);
    });

    it("returns false for non-ignored words", () => {
      const store = useSpellCheckStore.getState();

      store.addToIgnored("apple");

      expect(store.isIgnored("banana")).toBe(false);
    });

    it("returns false for empty ignored list", () => {
      const store = useSpellCheckStore.getState();

      expect(store.isIgnored("anything")).toBe(false);
    });

    it("returns false after word is removed", () => {
      const store = useSpellCheckStore.getState();

      store.addToIgnored("word");
      store.removeFromIgnored("word");

      expect(store.isIgnored("word")).toBe(false);
    });
  });

  describe("ignored words - clearIgnored", () => {
    it("clears all ignored words", () => {
      const store = useSpellCheckStore.getState();

      store.addToIgnored("apple");
      store.addToIgnored("banana");
      store.addToIgnored("cherry");
      store.clearIgnored();

      const state = useSpellCheckStore.getState();
      expect(state.ignoredWords).toEqual([]);
    });

    it("allows adding words after clear", () => {
      const store = useSpellCheckStore.getState();

      store.addToIgnored("old");
      store.clearIgnored();
      store.addToIgnored("new");

      const state = useSpellCheckStore.getState();
      expect(state.ignoredWords).toEqual(["new"]);
    });

    it("isIgnored returns false after clear", () => {
      const store = useSpellCheckStore.getState();

      store.addToIgnored("word");
      store.clearIgnored();

      expect(store.isIgnored("word")).toBe(false);
    });

    it("does nothing on empty list", () => {
      const store = useSpellCheckStore.getState();

      store.clearIgnored();

      const state = useSpellCheckStore.getState();
      expect(state.ignoredWords).toEqual([]);
    });
  });

  describe("integration scenarios", () => {
    it("popup state is independent of ignored words", () => {
      const store = useSpellCheckStore.getState();

      store.addToIgnored("word");
      store.openPopup({ top: 100, left: 200 }, { from: 0, to: 4, text: "word" }, []);

      const state = useSpellCheckStore.getState();
      expect(state.isPopupOpen).toBe(true);
      expect(state.ignoredWords).toContain("word");

      store.closePopup();
      const afterClose = useSpellCheckStore.getState();
      expect(afterClose.isPopupOpen).toBe(false);
      expect(afterClose.ignoredWords).toContain("word");
    });

    it("handles typical spell check workflow", () => {
      const store = useSpellCheckStore.getState();

      // User clicks on misspelled word
      store.openPopup(
        { top: 150, left: 300 },
        { from: 10, to: 14, text: "tset" },
        ["test", "set", "best"]
      );

      let state = useSpellCheckStore.getState();
      expect(state.isPopupOpen).toBe(true);
      expect(state.suggestions).toHaveLength(3);

      // User chooses "Add to Dictionary"
      store.addToIgnored(state.currentWord!.text);
      store.closePopup();

      state = useSpellCheckStore.getState();
      expect(state.isPopupOpen).toBe(false);
      expect(store.isIgnored("tset")).toBe(true);

      // Next time, the word should be ignored
      expect(store.isIgnored("TSET")).toBe(true);
    });
  });
});
