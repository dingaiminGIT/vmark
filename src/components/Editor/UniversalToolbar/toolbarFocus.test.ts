import { describe, it, expect } from "vitest";
import type { ToolbarButton } from "./toolbarGroups";
import { getInitialFocusIndex } from "./toolbarFocus";
import type { ToolbarContext } from "@/plugins/toolbarActions/types";

function makeButton(action: string): ToolbarButton {
  return {
    id: action,
    type: "button",
    icon: "",
    label: action,
    action,
    enabledIn: ["always"],
  };
}

const buttons = [
  makeButton("bold"),
  makeButton("heading"),
  makeButton("addRow"),
  makeButton("insertTable"),
];

function makeState(disabled = false, active = false) {
  return { disabled, notImplemented: false, active };
}

describe("getInitialFocusIndex", () => {
  it("prefers last focused when enabled", () => {
    const states = [makeState(), makeState(), makeState(), makeState()];
    const context: ToolbarContext = {
      surface: "source",
      view: null,
      context: {
        inCodeBlock: null,
        inBlockMath: null,
        inTable: null,
        inList: null,
        inBlockquote: null,
        inHeading: null,
        inLink: null,
        inImage: null,
        inInlineMath: null,
        inFootnote: null,
        activeFormats: [],
        formatRanges: [],
        innermostFormat: null,
        atLineStart: false,
        atBlankLine: false,
        inWord: null,
        contextMode: "inline-insert",
        nearSpace: false,
        nearPunctuation: false,
        hasSelection: false,
        selectionFrom: 0,
        selectionTo: 0,
      },
    };

    expect(
      getInitialFocusIndex({
        buttons,
        states,
        lastFocusedIndex: 2,
        context,
      })
    ).toBe(2);
  });

  it("focuses addRow when in table", () => {
    const states = [makeState(), makeState(), makeState(), makeState()];
    const context: ToolbarContext = {
      surface: "source",
      view: null,
      context: {
        inCodeBlock: null,
        inBlockMath: null,
        inTable: { row: 0, col: 0, isHeader: false, nodePos: 0 },
        inList: null,
        inBlockquote: null,
        inHeading: null,
        inLink: null,
        inImage: null,
        inInlineMath: null,
        inFootnote: null,
        activeFormats: [],
        formatRanges: [],
        innermostFormat: null,
        atLineStart: false,
        atBlankLine: false,
        inWord: null,
        contextMode: "inline-insert",
        nearSpace: false,
        nearPunctuation: false,
        hasSelection: false,
        selectionFrom: 0,
        selectionTo: 0,
      },
    };

    expect(
      getInitialFocusIndex({
        buttons,
        states,
        lastFocusedIndex: -1,
        context,
      })
    ).toBe(2);
  });
});
