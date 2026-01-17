import { describe, it, expect } from "vitest";
import { matchesShortcutEvent } from "@/utils/shortcutMatch";

function makeEvent(options: KeyboardEventInit & { key: string }) {
  return new KeyboardEvent("keydown", options);
}

describe("matchesShortcutEvent", () => {
  it("matches Mod-Shift-P on mac", () => {
    const event = makeEvent({ key: "P", metaKey: true, shiftKey: true });
    expect(matchesShortcutEvent(event, "Mod-Shift-p", "mac")).toBe(true);
  });

  it("matches Mod-Shift-P on non-mac", () => {
    const event = makeEvent({ key: "p", ctrlKey: true, shiftKey: true });
    expect(matchesShortcutEvent(event, "Mod-Shift-p", "other")).toBe(true);
  });

  it("rejects extra modifiers", () => {
    const event = makeEvent({ key: "p", ctrlKey: true, shiftKey: true, altKey: true });
    expect(matchesShortcutEvent(event, "Mod-Shift-p", "other")).toBe(false);
  });

  it("matches Alt-z", () => {
    const event = makeEvent({ key: "z", altKey: true });
    expect(matchesShortcutEvent(event, "Alt-z", "other")).toBe(true);
  });

  it("matches arrow key aliases", () => {
    const event = makeEvent({ key: "ArrowUp", ctrlKey: true, shiftKey: true });
    expect(matchesShortcutEvent(event, "Ctrl-Shift-Up", "other")).toBe(true);
  });

  it("matches shifted symbol variants", () => {
    const event = makeEvent({ key: "?", shiftKey: true, metaKey: true });
    expect(matchesShortcutEvent(event, "Mod-Shift-/", "mac")).toBe(true);
  });

  it("matches shifted . to >", () => {
    const event = makeEvent({ key: ">", shiftKey: true, metaKey: true });
    expect(matchesShortcutEvent(event, "Mod-Shift-.", "mac")).toBe(true);
  });
});
