import type { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import { useSourceFormatStore } from "@/stores/sourceFormatStore";
import type { BlockMathInfo } from "../blockMathDetection";
import { getBlockMathContentRange, getBlockMathUnwrapChanges } from "../mathActions";
import { icons, createIcon } from "@/utils/icons";

interface MathModeProps {
  editorView: EditorView;
  blockMathInfo: BlockMathInfo;
}

export function MathMode({ editorView, blockMathInfo }: MathModeProps) {
  const handleSelectContent = () => {
    const range = getBlockMathContentRange(editorView.state.doc, blockMathInfo);
    if (!range) return;

    editorView.dispatch({
      selection: EditorSelection.range(range.from, range.to),
    });
    editorView.focus();
    const store = useSourceFormatStore.getState();
    store.clearOriginalCursor();
    store.closePopup();
  };

  const handleUnwrap = () => {
    const changes = getBlockMathUnwrapChanges(editorView.state.doc, blockMathInfo);
    if (!changes || changes.length === 0) return;

    editorView.dispatch({ changes });
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
        title="Select math content"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleSelectContent}
      >
        {createIcon(icons.math)}
      </button>
      <button
        type="button"
        className="source-format-btn danger"
        title="Remove $$ delimiters"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleUnwrap}
      >
        {createIcon(icons.removeQuote)}
      </button>
    </div>
  );
}
