import { describe, it, expect } from "vitest";
import { findFootnoteDefinitionPos, renumberFootnotesDoc } from "./footnoteActions";

describe("footnoteActions", () => {
  it("finds definition position for a label", () => {
    const doc = "Text[^2]\n\n[^2]: two\n";
    const pos = findFootnoteDefinitionPos(doc, "2");
    expect(pos).toBe(doc.indexOf("[^2]:"));
  });

  it("renumbers footnotes based on reference order", () => {
    const doc = "A[^2]\n\n[^2]: two\nB[^1]\n\n[^1]: one\n";
    const result = renumberFootnotesDoc(doc);
    expect(result).not.toBeNull();
    expect(result).toContain("A[^1]");
    expect(result).toContain("B[^2]");
    expect(result).toContain("[^1]: two");
    expect(result).toContain("[^2]: one");
  });
});
