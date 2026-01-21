import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useImagePopupStore } from "@/stores/imagePopupStore";
import { saveImageChanges } from "../sourceImageActions";

function createView(doc: string): EditorView {
  const parent = document.createElement("div");
  const state = EditorState.create({ doc });
  return new EditorView({ state, parent });
}

describe("source image actions", () => {
  afterEach(() => {
    useImagePopupStore.getState().closePopup();
  });

  it("preserves title and angle-bracket destination when saving", () => {
    const doc = 'Image ![alt](<path with space> "Title") end.';
    const imageText = '![alt](<path with space> "Title")';
    const imageFrom = doc.indexOf(imageText);
    const view = createView(doc);

    useImagePopupStore.setState({
      isOpen: true,
      imageSrc: "new path",
      imageAlt: "alt",
      imageNodePos: imageFrom,
      imageNodeType: "image",
      anchorRect: null,
    });

    saveImageChanges(view);

    expect(view.state.doc.toString()).toBe(
      'Image ![alt](<new path> "Title") end.'
    );

    view.destroy();
  });
});
