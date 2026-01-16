import { EditorSelection, type SelectionRange } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { FORMAT_MARKERS, type FormatType, type WrapFormatType } from "./formatTypes";
import { getOppositeFormat, isWrapped, unwrap, wrap } from "./formatUtils";

type RangeFormatResult = {
  changes?: { from: number; to: number; insert: string } | Array<{ from: number; to: number; insert: string }>;
  range: SelectionRange;
};

function unwrapOppositeInRange(
  doc: string,
  format: FormatType,
  from: number,
  to: number,
  selectedText: string
): RangeFormatResult | null {
  const oppositeFormat = getOppositeFormat(format);
  if (!oppositeFormat) return null;

  const { prefix, suffix } = FORMAT_MARKERS[oppositeFormat];
  if (isWrapped(selectedText, prefix, suffix)) {
    const unwrapped = unwrap(selectedText, prefix, suffix);
    return {
      changes: { from, to, insert: unwrapped },
      range: EditorSelection.range(from, from + unwrapped.length),
    };
  }

  const prefixStart = from - prefix.length;
  const suffixEnd = to + suffix.length;
  if (prefixStart >= 0 && suffixEnd <= doc.length) {
    const textBefore = doc.slice(prefixStart, from);
    const textAfter = doc.slice(to, suffixEnd);
    if (textBefore === prefix && textAfter === suffix) {
      return {
        changes: [
          { from: prefixStart, to: from, insert: "" },
          { from: to, to: suffixEnd, insert: "" },
        ],
        range: EditorSelection.range(prefixStart, prefixStart + selectedText.length),
      };
    }
  }

  return null;
}

function formatRange(
  doc: string,
  range: SelectionRange,
  format: WrapFormatType
): RangeFormatResult {
  const { from, to } = range;
  if (from === to) {
    const { prefix, suffix } = FORMAT_MARKERS[format];
    return {
      changes: { from, to, insert: `${prefix}${suffix}` },
      range: EditorSelection.range(from + prefix.length, from + prefix.length),
    };
  }

  const selectedText = doc.slice(from, to);
  const oppositeResult = unwrapOppositeInRange(doc, format, from, to, selectedText);
  if (oppositeResult) return oppositeResult;

  const { prefix, suffix } = FORMAT_MARKERS[format];
  if (isWrapped(selectedText, prefix, suffix)) {
    const unwrapped = unwrap(selectedText, prefix, suffix);
    return {
      changes: { from, to, insert: unwrapped },
      range: EditorSelection.range(from, from + unwrapped.length),
    };
  }

  const prefixStart = from - prefix.length;
  const suffixEnd = to + suffix.length;
  if (prefixStart >= 0 && suffixEnd <= doc.length) {
    const textBefore = doc.slice(prefixStart, from);
    const textAfter = doc.slice(to, suffixEnd);
    if (textBefore === prefix && textAfter === suffix) {
      return {
        changes: [
          { from: prefixStart, to: from, insert: "" },
          { from: to, to: suffixEnd, insert: "" },
        ],
        range: EditorSelection.range(prefixStart, prefixStart + selectedText.length),
      };
    }
  }

  const wrapped = wrap(selectedText, prefix, suffix);
  return {
    changes: { from, to, insert: wrapped },
    range: EditorSelection.range(from + prefix.length, from + prefix.length + selectedText.length),
  };
}

export function applyInlineFormatToSelections(
  view: EditorView,
  format: WrapFormatType
): boolean {
  const { state } = view;
  if (state.selection.ranges.length <= 1) return false;

  const doc = state.doc.toString();
  const transaction = state.changeByRange((range) => formatRange(doc, range, format));
  view.dispatch(transaction);
  view.focus();
  return true;
}
