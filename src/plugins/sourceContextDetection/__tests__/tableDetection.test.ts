/**
 * Table Detection Tests
 *
 * Tests for isTableLine, getSourceTableInfo, and related utilities.
 * Covers escaped pipes, code spans, non-table pipe lines, and table boundaries.
 */

import { describe, expect, it } from "vitest";
import { splitTableCells, parseTableRow } from "@/utils/tableParser";

// We test the pure functions exported from tableDetection.
// getSourceTableInfo requires an EditorView, tested via integration or
// by extracting the internal helpers.

// Import the internal helpers we'll expose for testing
import { isTableLine } from "../tableDetection";

describe("isTableLine", () => {
  it("returns true for standard table row", () => {
    expect(isTableLine("| A | B |")).toBe(true);
  });

  it("returns true for separator line", () => {
    expect(isTableLine("| --- | --- |")).toBe(true);
  });

  it("returns true for row with escaped pipe", () => {
    expect(isTableLine("| A \\| B | C |")).toBe(true);
  });

  it("returns false for shell command with pipe", () => {
    expect(isTableLine("echo foo | grep bar")).toBe(false);
  });

  it("returns false for pipe in middle of sentence", () => {
    expect(isTableLine("Use A | B notation for alternatives")).toBe(false);
  });

  it("returns true for table row with leading whitespace", () => {
    expect(isTableLine("  | A | B |")).toBe(true);
  });

  it("returns false for empty line", () => {
    expect(isTableLine("")).toBe(false);
  });

  it("returns false for line with only pipe", () => {
    expect(isTableLine("|")).toBe(false);
  });

  it("returns true for minimal table row", () => {
    expect(isTableLine("| A |")).toBe(true);
  });

  it("returns false for single-cell line without trailing pipe", () => {
    expect(isTableLine("| A")).toBe(false);
  });

  it("returns true for two-column row", () => {
    expect(isTableLine("| A | B")).toBe(true);
  });
});

describe("splitTableCells with escaped pipes", () => {
  it("splits simple cells", () => {
    const cells = splitTableCells(" A | B ");
    expect(cells).toEqual([" A ", " B "]);
  });

  it("handles escaped pipe inside cell", () => {
    // "A \\| B | C" should produce 2 cells, not 3
    const cells = splitTableCells("A \\| B | C");
    expect(cells).toEqual(["A \\| B ", " C"]);
  });

  it("handles code span with pipe", () => {
    const cells = splitTableCells("`a|b` | c");
    expect(cells).toEqual(["`a|b` ", " c"]);
  });
});

describe("parseTableRow with escaped pipes", () => {
  it("parses simple row", () => {
    expect(parseTableRow("| A | B |")).toEqual(["A", "B"]);
  });

  it("parses row with escaped pipe", () => {
    expect(parseTableRow("| A \\| B | C |")).toEqual(["A \\| B", "C"]);
  });

  it("parses row with code span containing pipe", () => {
    expect(parseTableRow("| `a|b` | c |")).toEqual(["`a|b`", "c"]);
  });

  it("parses separator correctly", () => {
    expect(parseTableRow("| --- | :---: |")).toEqual(["---", ":---:"]);
  });
});
