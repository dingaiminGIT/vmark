import { describe, it, expect, afterEach } from "vitest";
import { useShortcutsStore } from "@/stores/shortcutsStore";
import { buildEditorKeymapBindings } from "./editorPlugins.tiptap";

function resetShortcuts() {
  useShortcutsStore.setState({ customBindings: {} });
}

afterEach(resetShortcuts);

describe("buildEditorKeymapBindings", () => {
  it("uses custom shortcut bindings from the store", () => {
    useShortcutsStore.setState({ customBindings: { bold: "Mod-Shift-b" } });
    const bindings = buildEditorKeymapBindings();

    expect(bindings["Mod-Shift-b"]).toBeTypeOf("function");
    expect(bindings["Mod-b"]).toBeUndefined();
  });

  it("includes sourcePeek binding", () => {
    const bindings = buildEditorKeymapBindings();
    // Default key is F5
    expect(bindings["F5"]).toBeTypeOf("function");
  });
});
