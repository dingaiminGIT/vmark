/**
 * Tab Escape Tests for WYSIWYG Mode
 *
 * Tests for Tab escaping out of inline marks (bold, italic, code, strike)
 * and links in TipTap/ProseMirror.
 */

import { describe, it, expect } from "vitest";
import { Schema, Node } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import {
  isAtMarkEnd,
  isInLink,
  getMarkEndPos,
  getLinkEndPos,
  canTabEscape,
  type TabEscapeResult,
} from "./tabEscape";

// Minimal schema for testing
const testSchema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*" },
    text: { group: "inline" },
  },
  marks: {
    bold: {},
    italic: {},
    code: {},
    strike: {},
    link: { attrs: { href: { default: "" }, title: { default: null } } },
  },
});

// Helper to create editor state with selection
function createState(doc: Node, from: number, to?: number): EditorState {
  const state = EditorState.create({ doc, schema: testSchema });
  const selection = to
    ? TextSelection.create(state.doc, from, to)
    : TextSelection.create(state.doc, from);
  return state.apply(state.tr.setSelection(selection));
}

// Helper to create document
function doc(...children: Node[]): Node {
  return testSchema.node("doc", null, children);
}

function p(...content: (Node | string)[]): Node {
  const children = content
    .filter((c) => c !== "")
    .map((c) => (typeof c === "string" ? testSchema.text(c) : c));
  return testSchema.node("paragraph", null, children.length > 0 ? children : undefined);
}

function boldText(text: string): Node {
  return testSchema.text(text, [testSchema.mark("bold")]);
}

function italicText(text: string): Node {
  return testSchema.text(text, [testSchema.mark("italic")]);
}

function codeText(text: string): Node {
  return testSchema.text(text, [testSchema.mark("code")]);
}

function strikeText(text: string): Node {
  return testSchema.text(text, [testSchema.mark("strike")]);
}

function linkedText(text: string, href: string): Node {
  return testSchema.text(text, [testSchema.mark("link", { href })]);
}

describe("isAtMarkEnd", () => {
  it("returns true when cursor is at end of bold text", () => {
    // "hello **bold** world" - cursor at end of "bold"
    const document = doc(p("hello ", boldText("bold"), " world"));
    const state = createState(document, 11); // After "bold", before space

    expect(isAtMarkEnd(state)).toBe(true);
  });

  it("returns true when cursor is at end of italic text", () => {
    const document = doc(p("hello ", italicText("italic"), " world"));
    const state = createState(document, 13); // After "italic"

    expect(isAtMarkEnd(state)).toBe(true);
  });

  it("returns true when cursor is at end of code text", () => {
    const document = doc(p("hello ", codeText("code"), " world"));
    const state = createState(document, 11); // After "code"

    expect(isAtMarkEnd(state)).toBe(true);
  });

  it("returns true when cursor is at end of strike text", () => {
    const document = doc(p("hello ", strikeText("strike"), " world"));
    const state = createState(document, 13); // After "strike"

    expect(isAtMarkEnd(state)).toBe(true);
  });

  it("returns false when cursor is in middle of marked text", () => {
    const document = doc(p("hello ", boldText("bold"), " world"));
    const state = createState(document, 9); // In middle of "bold"

    expect(isAtMarkEnd(state)).toBe(false);
  });

  it("returns false when cursor is at start of marked text", () => {
    const document = doc(p("hello ", boldText("bold"), " world"));
    const state = createState(document, 7); // At start of "bold"

    expect(isAtMarkEnd(state)).toBe(false);
  });

  it("returns false when cursor is in plain text", () => {
    const document = doc(p("hello world"));
    const state = createState(document, 6); // In "hello"

    expect(isAtMarkEnd(state)).toBe(false);
  });

  it("returns false when there is a selection", () => {
    const document = doc(p("hello ", boldText("bold"), " world"));
    const state = createState(document, 9, 11); // Selection inside bold

    expect(isAtMarkEnd(state)).toBe(false);
  });

  it("returns true when mark ends at document boundary", () => {
    const document = doc(p("hello ", boldText("bold")));
    const state = createState(document, 11); // At very end

    expect(isAtMarkEnd(state)).toBe(true);
  });
});

describe("isInLink", () => {
  it("returns true when cursor is inside link", () => {
    const document = doc(p("hello ", linkedText("link text", "https://example.com"), " world"));
    const state = createState(document, 10); // Inside "link text"

    expect(isInLink(state)).toBe(true);
  });

  it("returns false when cursor is outside link", () => {
    const document = doc(p("hello ", linkedText("link", "https://example.com"), " world"));
    const state = createState(document, 3); // In "hello"

    expect(isInLink(state)).toBe(false);
  });

  it("returns true inside link text", () => {
    const document = doc(p("hello ", linkedText("link", "https://example.com"), " world"));
    const state = createState(document, 8); // Inside "link" (not at boundary)

    expect(isInLink(state)).toBe(true);
  });

  it("returns true at end of link", () => {
    const document = doc(p("hello ", linkedText("link", "https://example.com"), " world"));
    const state = createState(document, 10); // Near end of "link"

    expect(isInLink(state)).toBe(true);
  });

  it("returns false when there is a selection", () => {
    const document = doc(p("hello ", linkedText("link", "https://example.com"), " world"));
    const state = createState(document, 7, 10); // Selection inside link

    expect(isInLink(state)).toBe(false);
  });
});

describe("getMarkEndPos", () => {
  it("returns position after bold mark", () => {
    // doc: "hello **bold** world"
    // positions: 0 = start of doc, 1 = start of p, 2-6 = "hello ", 7-10 = "bold", 11 = after bold
    const document = doc(p("hello ", boldText("bold"), " world"));
    const state = createState(document, 9); // Inside "bold"

    const endPos = getMarkEndPos(state);
    expect(endPos).toBe(11); // Position after the "d" in "bold"
  });

  it("returns position after italic mark", () => {
    const document = doc(p("hello ", italicText("ital"), " world"));
    const state = createState(document, 9);

    const endPos = getMarkEndPos(state);
    expect(endPos).toBe(11);
  });

  it("returns null when not in a mark", () => {
    const document = doc(p("hello world"));
    const state = createState(document, 5);

    const endPos = getMarkEndPos(state);
    expect(endPos).toBeNull();
  });

  it("returns null when there is a selection", () => {
    const document = doc(p("hello ", boldText("bold"), " world"));
    const state = createState(document, 7, 10);

    const endPos = getMarkEndPos(state);
    expect(endPos).toBeNull();
  });
});

describe("getLinkEndPos", () => {
  it("returns position after link", () => {
    const document = doc(p("hello ", linkedText("link", "https://example.com"), " world"));
    const state = createState(document, 8); // Inside "link"

    const endPos = getLinkEndPos(state);
    expect(endPos).toBe(11); // Position after "link"
  });

  it("returns null when not in a link", () => {
    const document = doc(p("hello world"));
    const state = createState(document, 5);

    const endPos = getLinkEndPos(state);
    expect(endPos).toBeNull();
  });

  it("returns null when there is a selection", () => {
    const document = doc(p("hello ", linkedText("link", "https://example.com"), " world"));
    const state = createState(document, 7, 10);

    const endPos = getLinkEndPos(state);
    expect(endPos).toBeNull();
  });
});

describe("canTabEscape", () => {
  it("returns target position when inside bold mark", () => {
    const document = doc(p("hello ", boldText("bold"), " world"));
    const state = createState(document, 9); // Inside "bold"

    const result = canTabEscape(state) as TabEscapeResult | null;
    expect(result).not.toBeNull();
    expect(result?.type).toBe("mark");
    expect(result?.targetPos).toBe(11); // Jump to position after mark
  });

  it("returns target position when in link", () => {
    const document = doc(p("hello ", linkedText("link", "https://example.com"), " world"));
    const state = createState(document, 9); // Inside "link"

    const result = canTabEscape(state) as TabEscapeResult | null;
    expect(result).not.toBeNull();
    expect(result?.type).toBe("link");
    expect(result?.targetPos).toBe(11); // Jump after link
  });

  it("returns null when in plain text", () => {
    const document = doc(p("hello world"));
    const state = createState(document, 5);

    const result = canTabEscape(state) as TabEscapeResult | null;
    expect(result).toBeNull();
  });

  it("returns target when in middle of mark", () => {
    const document = doc(p("hello ", boldText("bold"), " world"));
    const state = createState(document, 9); // Middle of "bold"

    const result = canTabEscape(state) as TabEscapeResult | null;
    // Tab should jump to end of mark from anywhere inside
    expect(result).not.toBeNull();
    expect(result?.type).toBe("mark");
    expect(result?.targetPos).toBe(11);
  });

  it("returns null when there is a selection", () => {
    const document = doc(p("hello ", boldText("bold"), " world"));
    const state = createState(document, 7, 11);

    const result = canTabEscape(state) as TabEscapeResult | null;
    expect(result).toBeNull();
  });

  it("prioritizes link escape over mark escape when both present", () => {
    // Bold text that is also a link
    const document = doc(
      p(
        "hello ",
        testSchema.text("bold link", [
          testSchema.mark("bold"),
          testSchema.mark("link", { href: "https://example.com" }),
        ]),
        " world"
      )
    );
    const state = createState(document, 12); // Inside "bold link"

    const result = canTabEscape(state) as TabEscapeResult | null;
    expect(result).not.toBeNull();
    expect(result?.type).toBe("link"); // Link takes priority
  });

  it("handles empty paragraph", () => {
    const document = doc(p(""));
    const state = createState(document, 1);

    const result = canTabEscape(state) as TabEscapeResult | null;
    expect(result).toBeNull();
  });

  it("handles mark at start of paragraph", () => {
    const document = doc(p(boldText("bold"), " world"));
    const state = createState(document, 3); // Inside "bold"

    const result = canTabEscape(state) as TabEscapeResult | null;
    expect(result).not.toBeNull();
    expect(result?.targetPos).toBe(5); // After "bold"
  });

  it("handles mark at end of paragraph", () => {
    const document = doc(p("hello ", boldText("bold")));
    const state = createState(document, 9); // Inside "bold" (near end of paragraph)

    const result = canTabEscape(state) as TabEscapeResult | null;
    expect(result).not.toBeNull();
    expect(result?.targetPos).toBe(11); // After "bold"
  });
});
