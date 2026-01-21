import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useLinkPopupStore } from "@/stores/linkPopupStore";
import { saveLinkChanges } from "../sourceLinkActions";

function createView(doc: string): EditorView {
  const parent = document.createElement("div");
  const state = EditorState.create({ doc });
  return new EditorView({ state, parent });
}

describe("source link actions", () => {
  afterEach(() => {
    useLinkPopupStore.getState().closePopup();
  });

  it("preserves title and angle-bracket destination when saving", () => {
    const doc = 'See [text](<path with space> "Title") here.';
    const linkText = '[text](<path with space> "Title")';
    const linkFrom = doc.indexOf(linkText);
    const linkTo = linkFrom + linkText.length;
    const view = createView(doc);

    useLinkPopupStore.setState({
      isOpen: true,
      href: "https://example.com",
      linkFrom,
      linkTo,
      anchorRect: null,
    });

    saveLinkChanges(view);

    expect(view.state.doc.toString()).toBe(
      'See [text](<https://example.com> "Title") here.'
    );

    view.destroy();
  });
});
