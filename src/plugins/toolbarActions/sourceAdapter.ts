import type { EditorView } from "@codemirror/view";
import { applyFormat, type FormatType } from "@/plugins/sourceFormatPopup";
import { getBlockquoteInfo, nestBlockquote, removeBlockquote, unnestBlockquote } from "@/plugins/sourceFormatPopup/blockquoteDetection";
import { convertToHeading, getHeadingInfo, setHeadingLevel } from "@/plugins/sourceFormatPopup/headingDetection";
import { getListItemInfo, indentListItem, outdentListItem, removeList, toBulletList, toOrderedList, toTaskList } from "@/plugins/sourceFormatPopup/listDetection";
import { getSourceTableInfo } from "@/plugins/sourceFormatPopup/tableDetection";
import { deleteColumn, deleteRow, deleteTable, insertColumnLeft, insertColumnRight, insertRowAbove, insertRowBelow, setAllColumnsAlignment, setColumnAlignment } from "@/plugins/sourceFormatPopup/tableActions";
import type { SourceToolbarContext } from "./types";

const TABLE_TEMPLATE = "| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n";

function insertText(view: EditorView, text: string, cursorOffset?: number) {
  const { from, to } = view.state.selection.main;
  const anchor = from;

  view.dispatch({
    changes: { from, to, insert: text },
    selection: {
      anchor: typeof cursorOffset === "number" ? anchor + cursorOffset : anchor + text.length,
    },
  });
  view.focus();
}

function applyInlineFormat(view: EditorView, format: FormatType): boolean {
  const { from, to } = view.state.selection.main;
  if (from === to) return false;
  applyFormat(view, format);
  return true;
}

function insertLink(view: EditorView): boolean {
  const { from, to } = view.state.selection.main;
  if (from !== to) {
    applyFormat(view, "link");
    return true;
  }

  const text = "[](url)";
  const cursorOffset = 3; // inside url
  insertText(view, text, cursorOffset);
  return true;
}

function insertImage(view: EditorView): boolean {
  insertText(view, "![](url)", 4);
  return true;
}

function insertFootnote(view: EditorView): boolean {
  return applyInlineFormat(view, "footnote");
}

function insertCodeBlock(view: EditorView): boolean {
  insertText(view, "```\n\n```", 4);
  return true;
}

function insertBlockquote(view: EditorView): boolean {
  insertText(view, "> ");
  return true;
}

function insertDivider(view: EditorView): boolean {
  insertText(view, "---\n");
  return true;
}

function insertTable(view: EditorView): boolean {
  insertText(view, TABLE_TEMPLATE, 2);
  return true;
}

function insertListMarker(view: EditorView, marker: string): boolean {
  insertText(view, marker);
  return true;
}

export function setSourceHeadingLevel(context: SourceToolbarContext, level: number): boolean {
  const view = context.view;
  if (!view) return false;

  const info = getHeadingInfo(view);
  if (info) {
    setHeadingLevel(view, info, level);
    return true;
  }

  if (level === 0) return false;
  convertToHeading(view, level);
  return true;
}

export function performSourceToolbarAction(action: string, context: SourceToolbarContext): boolean {
  const view = context.view;
  if (!view) return false;

  switch (action) {
    case "bold":
      return applyInlineFormat(view, "bold");
    case "italic":
      return applyInlineFormat(view, "italic");
    case "strikethrough":
      return applyInlineFormat(view, "strikethrough");
    case "highlight":
      return applyInlineFormat(view, "highlight");
    case "superscript":
      return applyInlineFormat(view, "superscript");
    case "subscript":
      return applyInlineFormat(view, "subscript");
    case "code":
      return applyInlineFormat(view, "code");
    case "link":
      return insertLink(view);
    case "insertImage":
      return insertImage(view);
    case "insertFootnote":
      return insertFootnote(view);
    case "bulletList": {
      const info = getListItemInfo(view);
      if (!info) return false;
      toBulletList(view, info);
      return true;
    }
    case "orderedList": {
      const info = getListItemInfo(view);
      if (!info) return false;
      toOrderedList(view, info);
      return true;
    }
    case "taskList": {
      const info = getListItemInfo(view);
      if (!info) return false;
      toTaskList(view, info);
      return true;
    }
    case "indent": {
      const info = getListItemInfo(view);
      if (!info) return false;
      indentListItem(view, info);
      return true;
    }
    case "outdent": {
      const info = getListItemInfo(view);
      if (!info) return false;
      outdentListItem(view, info);
      return true;
    }
    case "removeList": {
      const info = getListItemInfo(view);
      if (!info) return false;
      removeList(view, info);
      return true;
    }
    case "insertTable":
      return insertTable(view);
    case "addRowAbove": {
      const info = getSourceTableInfo(view);
      if (!info) return false;
      insertRowAbove(view, info);
      return true;
    }
    case "addRow": {
      const info = getSourceTableInfo(view);
      if (!info) return false;
      insertRowBelow(view, info);
      return true;
    }
    case "addColLeft": {
      const info = getSourceTableInfo(view);
      if (!info) return false;
      insertColumnLeft(view, info);
      return true;
    }
    case "addCol": {
      const info = getSourceTableInfo(view);
      if (!info) return false;
      insertColumnRight(view, info);
      return true;
    }
    case "deleteRow": {
      const info = getSourceTableInfo(view);
      if (!info) return false;
      deleteRow(view, info);
      return true;
    }
    case "deleteCol": {
      const info = getSourceTableInfo(view);
      if (!info) return false;
      deleteColumn(view, info);
      return true;
    }
    case "deleteTable": {
      const info = getSourceTableInfo(view);
      if (!info) return false;
      deleteTable(view, info);
      return true;
    }
    case "alignLeft": {
      const info = getSourceTableInfo(view);
      if (!info) return false;
      setColumnAlignment(view, info, "left");
      return true;
    }
    case "alignCenter": {
      const info = getSourceTableInfo(view);
      if (!info) return false;
      setColumnAlignment(view, info, "center");
      return true;
    }
    case "alignRight": {
      const info = getSourceTableInfo(view);
      if (!info) return false;
      setColumnAlignment(view, info, "right");
      return true;
    }
    case "alignAllLeft": {
      const info = getSourceTableInfo(view);
      if (!info) return false;
      setAllColumnsAlignment(view, info, "left");
      return true;
    }
    case "alignAllCenter": {
      const info = getSourceTableInfo(view);
      if (!info) return false;
      setAllColumnsAlignment(view, info, "center");
      return true;
    }
    case "alignAllRight": {
      const info = getSourceTableInfo(view);
      if (!info) return false;
      setAllColumnsAlignment(view, info, "right");
      return true;
    }
    case "nestQuote": {
      const info = getBlockquoteInfo(view);
      if (!info) return false;
      nestBlockquote(view, info);
      return true;
    }
    case "unnestQuote": {
      const info = getBlockquoteInfo(view);
      if (!info) return false;
      unnestBlockquote(view, info);
      return true;
    }
    case "removeQuote": {
      const info = getBlockquoteInfo(view);
      if (!info) return false;
      removeBlockquote(view, info);
      return true;
    }
    case "insertCodeBlock":
      return insertCodeBlock(view);
    case "insertBlockquote":
      return insertBlockquote(view);
    case "insertDivider":
      return insertDivider(view);
    case "insertTableBlock":
      return insertTable(view);
    case "insertBulletList":
      return insertListMarker(view, "- ");
    case "insertOrderedList":
      return insertListMarker(view, "1. ");
    case "insertTaskList":
      return insertListMarker(view, "- [ ] ");
    default:
      return false;
  }
}
