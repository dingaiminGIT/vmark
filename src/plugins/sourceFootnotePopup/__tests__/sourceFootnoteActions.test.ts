import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useFootnotePopupStore } from "@/stores/footnotePopupStore";
import { removeFootnote, saveFootnoteContent } from "../sourceFootnoteActions";

function createView(doc: string): EditorView {
  const parent = document.createElement("div");
  const state = EditorState.create({ doc });
  return new EditorView({ state, parent });
}

describe("source footnote actions", () => {
  afterEach(() => {
    useFootnotePopupStore.getState().closePopup();
  });

  it("updates multi-line footnote definitions", () => {
    const doc = "Ref[^1]\n\n[^1]: first line\n  second line\n  third line\n\nAfter.";
    const definitionPos = doc.indexOf("[^1]:");
    const referencePos = doc.indexOf("[^1]");
    const view = createView(doc);

    useFootnotePopupStore.setState({
      isOpen: true,
      label: "1",
      content: "updated line\nsecond updated",
      anchorRect: null,
      definitionPos,
      referencePos,
      autoFocus: false,
    });

    saveFootnoteContent(view);

    expect(view.state.doc.toString()).toBe(
      "Ref[^1]\n\n[^1]: updated line\n  second updated\n\nAfter."
    );

    view.destroy();
  });

  it("removes all references and the definition block", () => {
    const doc = "Ref[^a] middle [^a].\n\n[^a]: note\n  more\nAfter.";
    const definitionPos = doc.indexOf("[^a]:");
    const referencePos = doc.indexOf("[^a]");
    const view = createView(doc);

    useFootnotePopupStore.setState({
      isOpen: true,
      label: "a",
      content: "",
      anchorRect: null,
      definitionPos,
      referencePos,
      autoFocus: false,
    });

    removeFootnote(view);

    expect(view.state.doc.toString()).toBe("Ref middle .\n\nAfter.");

    view.destroy();
  });
});
