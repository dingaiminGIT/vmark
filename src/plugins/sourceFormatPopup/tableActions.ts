/**
 * Table Actions for Source Mode
 *
 * Functions to modify markdown tables in raw text.
 */

import type { EditorView } from "@codemirror/view";
import { getDisplayWidth, padToWidth } from "@/utils/stringWidth";
import type { SourceTableInfo, TableAlignment } from "./tableDetection";

/**
 * Parse a table row into cells.
 */
function parseRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

/**
 * Parse alignment from a separator cell.
 */
function parseAlignment(cell: string): TableAlignment {
  const trimmed = cell.trim();
  const hasLeft = trimmed.startsWith(":");
  const hasRight = trimmed.endsWith(":");

  if (hasLeft && hasRight) return "center";
  if (hasRight) return "right";
  return "left";
}

/**
 * Format a separator cell with alignment.
 */
function formatAlignmentCell(alignment: TableAlignment, width = 5): string {
  const dashes = "-".repeat(Math.max(3, width - 2));
  switch (alignment) {
    case "center":
      return `:${dashes}:`;
    case "right":
      return `${dashes}:`;
    default:
      return dashes;
  }
}

/**
 * Insert a new row below current position.
 */
export function insertRowBelow(view: EditorView, info: SourceTableInfo): void {
  const doc = view.state.doc;
  const currentLineNum = info.startLine + 1 + info.rowIndex;
  const currentLine = doc.line(currentLineNum);

  const cells = Array(info.colCount).fill("     ");
  const newRow = `| ${cells.join(" | ")} |`;

  view.dispatch({
    changes: { from: currentLine.to, insert: `\n${newRow}` },
    selection: { anchor: currentLine.to + 3 },
  });

  view.focus();
}

/**
 * Insert a new row above current position.
 */
export function insertRowAbove(view: EditorView, info: SourceTableInfo): void {
  const doc = view.state.doc;

  // Can't insert above header - insert below separator instead
  if (info.rowIndex === 0) {
    const separatorLine = doc.line(info.startLine + 2);
    const cells = Array(info.colCount).fill("     ");
    const newRow = `| ${cells.join(" | ")} |`;
    view.dispatch({
      changes: { from: separatorLine.to, insert: `\n${newRow}` },
      selection: { anchor: separatorLine.to + 3 },
    });
    view.focus();
    return;
  }

  const currentLineNum = info.startLine + 1 + info.rowIndex;
  const currentLine = doc.line(currentLineNum);

  const cells = Array(info.colCount).fill("     ");
  const newRow = `| ${cells.join(" | ")} |\n`;

  view.dispatch({
    changes: { from: currentLine.from, insert: newRow },
    selection: { anchor: currentLine.from + 2 },
  });

  view.focus();
}

/**
 * Insert a new column to the right of current position.
 */
export function insertColumnRight(
  view: EditorView,
  info: SourceTableInfo
): void {
  const changes: { from: number; to: number; insert: string }[] = [];
  const doc = view.state.doc;

  for (let i = 0; i < info.lines.length; i++) {
    const lineNum = info.startLine + 1 + i;
    const line = doc.line(lineNum);
    const cells = parseRow(info.lines[i]);

    const insertIdx = Math.min(info.colIndex + 1, cells.length);
    cells.splice(insertIdx, 0, i === 1 ? "-----" : "     ");

    const newLine = `| ${cells.join(" | ")} |`;
    changes.push({ from: line.from, to: line.to, insert: newLine });
  }

  view.dispatch({ changes });
  view.focus();
}

/**
 * Insert a new column to the left of current position.
 */
export function insertColumnLeft(
  view: EditorView,
  info: SourceTableInfo
): void {
  const changes: { from: number; to: number; insert: string }[] = [];
  const doc = view.state.doc;

  for (let i = 0; i < info.lines.length; i++) {
    const lineNum = info.startLine + 1 + i;
    const line = doc.line(lineNum);
    const cells = parseRow(info.lines[i]);

    cells.splice(info.colIndex, 0, i === 1 ? "-----" : "     ");

    const newLine = `| ${cells.join(" | ")} |`;
    changes.push({ from: line.from, to: line.to, insert: newLine });
  }

  view.dispatch({ changes });
  view.focus();
}

/**
 * Delete current row.
 */
export function deleteRow(view: EditorView, info: SourceTableInfo): void {
  // Can't delete header or separator
  if (info.rowIndex <= 1) return;

  const doc = view.state.doc;
  const lineNum = info.startLine + 1 + info.rowIndex;
  const line = doc.line(lineNum);

  const deleteFrom = line.from - 1;
  const deleteTo = line.to;

  view.dispatch({
    changes: { from: deleteFrom, to: deleteTo },
  });

  view.focus();
}

/**
 * Delete current column.
 */
export function deleteColumn(view: EditorView, info: SourceTableInfo): void {
  if (info.colCount <= 1) return;

  const changes: { from: number; to: number; insert: string }[] = [];
  const doc = view.state.doc;

  for (let i = 0; i < info.lines.length; i++) {
    const lineNum = info.startLine + 1 + i;
    const line = doc.line(lineNum);
    const cells = parseRow(info.lines[i]);

    if (info.colIndex < cells.length) {
      cells.splice(info.colIndex, 1);
    }

    const newLine = `| ${cells.join(" | ")} |`;
    changes.push({ from: line.from, to: line.to, insert: newLine });
  }

  view.dispatch({ changes });
  view.focus();
}

/**
 * Delete entire table.
 */
export function deleteTable(view: EditorView, info: SourceTableInfo): void {
  const doc = view.state.doc;
  const startLine = doc.line(info.startLine + 1);
  const endLine = doc.line(info.endLine + 1);

  let deleteTo = endLine.to;
  if (deleteTo < doc.length && doc.sliceString(deleteTo, deleteTo + 1) === "\n") {
    deleteTo++;
  }

  view.dispatch({
    changes: { from: startLine.from, to: deleteTo },
  });

  view.focus();
}

/**
 * Get current column alignment.
 */
export function getColumnAlignment(info: SourceTableInfo): TableAlignment {
  const separatorCells = parseRow(info.lines[1]);
  if (info.colIndex < separatorCells.length) {
    return parseAlignment(separatorCells[info.colIndex]);
  }
  return "left";
}

/**
 * Set alignment for current column.
 */
export function setColumnAlignment(
  view: EditorView,
  info: SourceTableInfo,
  alignment: TableAlignment
): void {
  const doc = view.state.doc;
  const separatorLineNum = info.startLine + 2;
  const separatorLine = doc.line(separatorLineNum);

  const cells = parseRow(info.lines[1]);
  if (info.colIndex < cells.length) {
    cells[info.colIndex] = formatAlignmentCell(alignment);
  }

  const newLine = `| ${cells.join(" | ")} |`;
  view.dispatch({
    changes: { from: separatorLine.from, to: separatorLine.to, insert: newLine },
  });

  view.focus();
}

/**
 * Set alignment for all columns.
 */
export function setAllColumnsAlignment(
  view: EditorView,
  info: SourceTableInfo,
  alignment: TableAlignment
): void {
  const doc = view.state.doc;
  const separatorLineNum = info.startLine + 2;
  const separatorLine = doc.line(separatorLineNum);

  const cells = parseRow(info.lines[1]);
  const newCells = cells.map(() => formatAlignmentCell(alignment));

  const newLine = `| ${newCells.join(" | ")} |`;
  view.dispatch({
    changes: { from: separatorLine.from, to: separatorLine.to, insert: newLine },
  });

  view.focus();
}

/**
 * Format table with space-padded columns.
 */
export function formatTable(view: EditorView, info: SourceTableInfo): void {
  const doc = view.state.doc;

  const parsedRows = info.lines.map((line) => parseRow(line));

  // Calculate max width for each column
  const colWidths: number[] = [];
  for (let col = 0; col < info.colCount; col++) {
    let maxWidth = 3;
    for (let row = 0; row < parsedRows.length; row++) {
      if (row === 1) continue;
      const cell = parsedRows[row][col] || "";
      maxWidth = Math.max(maxWidth, getDisplayWidth(cell));
    }
    colWidths.push(maxWidth);
  }

  // Build formatted lines
  const formattedLines: string[] = [];
  for (let row = 0; row < parsedRows.length; row++) {
    const cells = parsedRows[row];
    const formattedCells: string[] = [];

    for (let col = 0; col < info.colCount; col++) {
      const cell = cells[col] || "";
      if (row === 1) {
        const alignment = parseAlignment(cell);
        formattedCells.push(formatAlignmentCell(alignment, colWidths[col]));
      } else {
        formattedCells.push(padToWidth(cell, colWidths[col]));
      }
    }

    formattedLines.push(`| ${formattedCells.join(" | ")} |`);
  }

  const startLine = doc.line(info.startLine + 1);
  const endLine = doc.line(info.endLine + 1);
  const newContent = formattedLines.join("\n");

  view.dispatch({
    changes: { from: startLine.from, to: endLine.to, insert: newContent },
  });

  view.focus();
}
