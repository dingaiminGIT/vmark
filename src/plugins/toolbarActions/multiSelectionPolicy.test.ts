import { describe, expect, it } from "vitest";
import { canRunActionInMultiSelection, getMultiSelectionPolicyForAction } from "./multiSelectionPolicy";
import type { MultiSelectionContext } from "./types";

const baseContext: MultiSelectionContext = {
  enabled: true,
  reason: "multi",
  inCodeBlock: false,
  inTable: false,
  inList: false,
  inBlockquote: false,
  inHeading: false,
  inLink: false,
  inInlineMath: false,
  inFootnote: false,
  inImage: false,
  inTextblock: true,
  sameBlockParent: true,
  blockParentType: "paragraph",
};

describe("multi-selection policy", () => {
  it("returns policy for known actions", () => {
    expect(getMultiSelectionPolicyForAction("bold")).toBe("allow");
    expect(getMultiSelectionPolicyForAction("heading:1")).toBe("conditional");
    expect(getMultiSelectionPolicyForAction("insertTable")).toBe("disallow");
  });

  it("allows inline marks when compatible", () => {
    expect(canRunActionInMultiSelection("bold", baseContext)).toBe(true);
    expect(canRunActionInMultiSelection("code", baseContext)).toBe(true);
  });

  it("disallows inserts and table actions during multi-selection", () => {
    expect(canRunActionInMultiSelection("insertTable", baseContext)).toBe(false);
    expect(canRunActionInMultiSelection("addRow", baseContext)).toBe(false);
  });

  it("blocks conditional actions when in disallowed contexts", () => {
    expect(
      canRunActionInMultiSelection("heading:2", { ...baseContext, inCodeBlock: true })
    ).toBe(false);
    expect(
      canRunActionInMultiSelection("bulletList", { ...baseContext, inTable: true })
    ).toBe(false);
    expect(
      canRunActionInMultiSelection("orderedList", { ...baseContext, sameBlockParent: false })
    ).toBe(false);
  });
});
