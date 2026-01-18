import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "./uiStore";

function resetUIStore() {
  useUIStore.setState({
    settingsOpen: false,
    sidebarVisible: false,
    sidebarWidth: 260,
    outlineVisible: false,
    sidebarViewMode: "outline",
    activeHeadingLine: null,
    statusBarVisible: true,
    universalToolbarVisible: false,
    universalToolbarHasFocus: false,
    lastFocusedToolbarIndex: 0,
  });
}

beforeEach(resetUIStore);

describe("uiStore", () => {
  it("toggles toolbar visibility and focus together", () => {
    const store = useUIStore.getState();

    store.toggleUniversalToolbar();
    expect(useUIStore.getState().universalToolbarVisible).toBe(true);
    expect(useUIStore.getState().universalToolbarHasFocus).toBe(true);

    store.toggleUniversalToolbar();
    expect(useUIStore.getState().universalToolbarVisible).toBe(false);
    expect(useUIStore.getState().universalToolbarHasFocus).toBe(false);
  });

  it("clears focus when toolbar is hidden", () => {
    useUIStore.setState({
      universalToolbarVisible: true,
      universalToolbarHasFocus: true,
    });

    const store = useUIStore.getState();
    store.setUniversalToolbarVisible(false);

    expect(useUIStore.getState().universalToolbarVisible).toBe(false);
    expect(useUIStore.getState().universalToolbarHasFocus).toBe(false);
  });

  it("does not force focus when showing toolbar via setVisible", () => {
    const store = useUIStore.getState();
    store.setUniversalToolbarVisible(true);

    expect(useUIStore.getState().universalToolbarVisible).toBe(true);
    expect(useUIStore.getState().universalToolbarHasFocus).toBe(false);
  });
});
