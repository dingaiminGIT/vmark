import { describe, it, expect } from "vitest";
import type { EditorView as CodeMirrorView } from "@codemirror/view";
import { getToolbarButtonState } from "./enableRules";
import type { ToolbarButton } from "@/components/Editor/UniversalToolbar/toolbarGroups";

function createButton(action: string, enabledIn: ToolbarButton["enabledIn"]): ToolbarButton {
  return {
    id: action,
    type: "button",
    icon: "",
    label: action,
    action,
    enabledIn,
  };
}

describe("getToolbarButtonState (source)", () => {
  const view = {} as CodeMirrorView;

  it("disables inline formats without selection", () => {
    const button = createButton("bold", ["textblock"]);
    const state = getToolbarButtonState(button, {
      surface: "source",
      view,
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
    });

    expect(state.disabled).toBe(true);
  });

  it("enables inline formats with selection", () => {
    const button = createButton("bold", ["textblock"]);
    const state = getToolbarButtonState(button, {
      surface: "source",
      view,
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
        hasSelection: true,
        selectionFrom: 1,
        selectionTo: 3,
      },
    });

    expect(state.disabled).toBe(false);
  });

  it("disables unimplemented actions in source mode", () => {
    const button = createButton("insertDetails", ["textblock"]);
    const state = getToolbarButtonState(button, {
      surface: "source",
      view,
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
    });

    expect(state.notImplemented).toBe(true);
    expect(state.disabled).toBe(true);
  });

  it("enables list actions when in list", () => {
    const button = createButton("indent", ["list"]);
    const state = getToolbarButtonState(button, {
      surface: "source",
      view,
      context: {
        inCodeBlock: null,
        inBlockMath: null,
        inTable: null,
        inList: { type: "bullet", depth: 1, nodePos: 0 },
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
    });

    expect(state.disabled).toBe(false);
  });
});
