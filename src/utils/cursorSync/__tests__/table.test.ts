import { describe, it, expect } from "vitest";
import { getTableAnchorForLine } from "../table";

describe("getTableAnchorForLine", () => {
  it("returns header row/col and offset for table header", () => {
    const lines = ["| Col1 | Col2 |", "| --- | --- |", "| a | bb |"];
    const lineIndex = 0;
    const column = lines[0].indexOf("Col2") + 1;
    const anchor = getTableAnchorForLine(lines, lineIndex, column);

    expect(anchor).toEqual({
      kind: "table",
      row: 0,
      col: 1,
      offsetInCell: 1,
    });
  });

  it("returns body row/col and offset for table body", () => {
    const lines = ["| Col1 | Col2 |", "| --- | --- |", "| a | bb |"];
    const lineIndex = 2;
    const column = lines[2].indexOf("bb") + 1;
    const anchor = getTableAnchorForLine(lines, lineIndex, column);

    expect(anchor).toEqual({
      kind: "table",
      row: 1,
      col: 1,
      offsetInCell: 1,
    });
  });

  it("returns undefined for separator lines", () => {
    const lines = ["| Col1 | Col2 |", "| --- | --- |", "| a | bb |"];
    const anchor = getTableAnchorForLine(lines, 1, 2);
    expect(anchor).toBeUndefined();
  });

  it("returns undefined when no table structure is detected", () => {
    const lines = ["| not a table | maybe |", "plain text"];
    const anchor = getTableAnchorForLine(lines, 0, 3);
    expect(anchor).toBeUndefined();
  });
});
