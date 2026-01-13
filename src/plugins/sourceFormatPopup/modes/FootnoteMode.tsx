import type { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import { useSourceFormatStore } from "@/stores/sourceFormatStore";
import type { FootnoteContext } from "@/types/cursorContext";
import { findFootnoteDefinitionPos, renumberFootnotesDoc } from "../footnoteActions";
import { icons, createIcon } from "@/utils/icons";

interface FootnoteModeProps {
  editorView: EditorView;
  footnoteInfo: FootnoteContext;
}

export function FootnoteMode({ editorView, footnoteInfo }: FootnoteModeProps) {
  const handleGoToDefinition = () => {
    const doc = editorView.state.doc.toString();
    const pos = findFootnoteDefinitionPos(doc, footnoteInfo.label);
    if (pos === null) return;

    editorView.dispatch({
      selection: EditorSelection.cursor(pos),
    });
    editorView.focus();
    const store = useSourceFormatStore.getState();
    store.clearOriginalCursor();
    store.closePopup();
  };

  const handleRenumber = () => {
    const doc = editorView.state.doc.toString();
    const updated = renumberFootnotesDoc(doc);
    if (!updated) return;

    const { from } = editorView.state.selection.main;
    editorView.dispatch({
      changes: { from: 0, to: doc.length, insert: updated },
      selection: EditorSelection.cursor(Math.min(from, updated.length)),
    });
    editorView.focus();
    const store = useSourceFormatStore.getState();
    store.clearOriginalCursor();
    store.closePopup();
  };

  return (
    <div className="source-format-row">
      <button
        type="button"
        className="source-format-btn"
        title="Go to definition"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleGoToDefinition}
      >
        {createIcon(icons.footnote)}
      </button>
      <button
        type="button"
        className="source-format-btn"
        title="Renumber footnotes"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleRenumber}
      >
        {createIcon(icons.orderedList)}
      </button>
    </div>
  );
}
