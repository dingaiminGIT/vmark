/**
 * UniversalToolbar - Tests
 *
 * TDD tests for the universal bottom toolbar shell (WI-001).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useUIStore } from "@/stores/uiStore";

const mockedStores = vi.hoisted(() => ({
  sourceState: {
    context: null,
    editorView: null,
  },
  tiptapState: {
    editor: null,
    editorView: null,
    context: null,
  },
}));

vi.mock("@/stores/sourceCursorContextStore", () => {
  type StoreState = typeof mockedStores.sourceState;
  type StoreHook = ((selector?: (state: StoreState) => unknown) => unknown) & {
    getState: () => StoreState;
    setState: (next: Partial<StoreState>) => void;
  };
  const store = ((selector?: (state: StoreState) => unknown) =>
    selector ? selector(mockedStores.sourceState) : mockedStores.sourceState) as unknown as StoreHook;
  store.getState = () => mockedStores.sourceState;
  store.setState = (next) => Object.assign(mockedStores.sourceState, next);
  return { useSourceCursorContextStore: store };
});

vi.mock("@/stores/tiptapEditorStore", () => {
  type StoreState = typeof mockedStores.tiptapState;
  type StoreHook = ((selector?: (state: StoreState) => unknown) => unknown) & {
    getState: () => StoreState;
    setState: (next: Partial<StoreState>) => void;
  };
  const store = ((selector?: (state: StoreState) => unknown) =>
    selector ? selector(mockedStores.tiptapState) : mockedStores.tiptapState) as unknown as StoreHook;
  store.getState = () => mockedStores.tiptapState;
  store.setState = (next) => Object.assign(mockedStores.tiptapState, next);
  return { useTiptapEditorStore: store };
});

import { UniversalToolbar } from "./UniversalToolbar";

describe("UniversalToolbar", () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({
      universalToolbarVisible: false,
    });
    mockedStores.sourceState.context = null;
    mockedStores.sourceState.editorView = null;
    mockedStores.tiptapState.context = null;
    mockedStores.tiptapState.editorView = null;
    mockedStores.tiptapState.editor = null;
  });

  describe("visibility", () => {
    it("renders nothing when visibility is false", () => {
      useUIStore.setState({ universalToolbarVisible: false });
      render(<UniversalToolbar />);
      expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    });

    it("renders toolbar container when visibility is true", () => {
      useUIStore.setState({ universalToolbarVisible: true });
      render(<UniversalToolbar />);
      expect(screen.getByRole("toolbar")).toBeInTheDocument();
    });
  });

  describe("styling", () => {
    it("has correct class name for styling", () => {
      useUIStore.setState({ universalToolbarVisible: true });
      render(<UniversalToolbar />);
      expect(screen.getByRole("toolbar")).toHaveClass("universal-toolbar");
    });

    it("has aria-label for accessibility", () => {
      useUIStore.setState({ universalToolbarVisible: true });
      render(<UniversalToolbar />);
      expect(screen.getByRole("toolbar")).toHaveAttribute(
        "aria-label",
        "Formatting toolbar"
      );
    });
  });
});
