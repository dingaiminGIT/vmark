import { describe, it, expect } from "vitest";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { MultiSelectionContext } from "./types";
import { performSourceToolbarAction } from "./sourceAdapter";

function createView(doc: string, ranges: Array<{ from: number; to: number }>): EditorView {
  const parent = document.createElement("div");
  const selection = EditorSelection.create(
    ranges.map((range) => EditorSelection.range(range.from, range.to))
  );
  const state = EditorState.create({
    doc,
    selection,
    extensions: [EditorState.allowMultipleSelections.of(true)],
  });
  return new EditorView({ state, parent });
}

const multiSelection: MultiSelectionContext = {
  enabled: true,
  reason: "multi",
  inCodeBlock: false,
  inTable: false,
  inList: false,
  inBlockquote: false,
  inHeading: false,
  inLink: false,
  inInlineMath: false,
  inFootnote: false,
  inImage: false,
  inTextblock: true,
  sameBlockParent: true,
  blockParentType: "paragraph",
};

const singleSelection: MultiSelectionContext = {
  ...multiSelection,
  enabled: false,
};

describe("performSourceToolbarAction", () => {
  it("clears formatting across multiple selections", () => {
    const view = createView("**one** **two**", [
      { from: 0, to: 7 },
      { from: 8, to: 15 },
    ]);

    const applied = performSourceToolbarAction("clearFormatting", {
      surface: "source",
      view,
      context: null,
      multiSelection,
    });

    expect(applied).toBe(true);
    expect(view.state.doc.toString()).toBe("one two");
    view.destroy();
  });

  it("toggles blockquote on and off", () => {
    const view = createView("Hello", [{ from: 0, to: 0 }]);

    const applied = performSourceToolbarAction("insertBlockquote", {
      surface: "source",
      view,
      context: null,
      multiSelection: singleSelection,
    });

    expect(applied).toBe(true);
    expect(view.state.doc.toString()).toBe("> Hello");

    const toggled = performSourceToolbarAction("insertBlockquote", {
      surface: "source",
      view,
      context: null,
      multiSelection: singleSelection,
    });

    expect(toggled).toBe(true);
    expect(view.state.doc.toString()).toBe("Hello");
    view.destroy();
  });

  it("creates a bullet list from a paragraph", () => {
    const view = createView("Item", [{ from: 0, to: 0 }]);

    const applied = performSourceToolbarAction("bulletList", {
      surface: "source",
      view,
      context: null,
      multiSelection: singleSelection,
    });

    expect(applied).toBe(true);
    expect(view.state.doc.toString()).toBe("- Item");
    view.destroy();
  });

  it("converts a bullet list to an ordered list", () => {
    const view = createView("- Item", [{ from: 2, to: 2 }]);

    const applied = performSourceToolbarAction("orderedList", {
      surface: "source",
      view,
      context: null,
      multiSelection: singleSelection,
    });

    expect(applied).toBe(true);
    expect(view.state.doc.toString()).toBe("1. Item");
    view.destroy();
  });
});
