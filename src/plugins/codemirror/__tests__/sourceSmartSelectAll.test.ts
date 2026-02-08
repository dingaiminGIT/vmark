/**
 * Source Smart Select-All Tests
 *
 * Tests for the unified Mod-a handler in source mode,
 * covering block detection priority and two-press behavior.
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { getSourceBlockBounds } from "../sourceShortcuts";

function createView(content: string, cursorPos: number): EditorView {
  const state = EditorState.create({
    doc: content,
    selection: { anchor: cursorPos },
  });
  return new EditorView({
    state,
    parent: document.createElement("div"),
  });
}

function createViewWithSelection(content: string, from: number, to: number): EditorView {
  const state = EditorState.create({
    doc: content,
    selection: { anchor: from, head: to },
  });
  return new EditorView({
    state,
    parent: document.createElement("div"),
  });
}

describe("source mode block detection priority", () => {
  it("cursor in code fence selects fence content", () => {
    const content = "```js\nconst x = 1;\n```";
    const view = createView(content, 10);
    const bounds = getSourceBlockBounds(view);

    expect(bounds).not.toBeNull();
    // Content is between opening and closing fence lines
    const doc = view.state.doc;
    expect(bounds!.from).toBe(doc.line(2).from);
    expect(bounds!.to).toBe(doc.line(2).to);
    view.destroy();
  });

  it("cursor in table selects table", () => {
    const content = "| A | B |\n|---|---|\n| 1 | 2 |";
    const view = createView(content, 3);
    const bounds = getSourceBlockBounds(view);

    expect(bounds).not.toBeNull();
    expect(bounds!.from).toBe(0);
    expect(bounds!.to).toBe(content.length);
    view.destroy();
  });

  it("cursor in blockquote selects blockquote", () => {
    const content = "> quoted line\n> another line";
    const view = createView(content, 5);
    const bounds = getSourceBlockBounds(view);

    expect(bounds).not.toBeNull();
    expect(bounds!.from).toBe(0);
    expect(bounds!.to).toBe(content.length);
    view.destroy();
  });

  it("cursor in list selects list block", () => {
    const content = "- item one\n- item two";
    const view = createView(content, 5);
    const bounds = getSourceBlockBounds(view);

    expect(bounds).not.toBeNull();
    expect(bounds!.from).toBe(0);
    expect(bounds!.to).toBe(content.length);
    view.destroy();
  });

  it("cursor in plain text returns null", () => {
    const content = "Just some plain text";
    const view = createView(content, 5);
    expect(getSourceBlockBounds(view)).toBeNull();
    view.destroy();
  });
});

describe("two-press behavior", () => {
  it("code fence: already selecting content falls through", () => {
    const content = "```js\nconst x = 1;\n```";
    const doc = EditorState.create({ doc: content }).doc;
    const contentFrom = doc.line(2).from;
    const contentTo = doc.line(2).to;

    const view = createViewWithSelection(content, contentFrom, contentTo);
    const bounds = getSourceBlockBounds(view);

    // bounds should still return the fence content
    expect(bounds).not.toBeNull();
    // But from/to match current selection -> handler should fall through
    const { from, to } = view.state.selection.main;
    expect(from).toBe(bounds!.from);
    expect(to).toBe(bounds!.to);
    view.destroy();
  });

  it("table: already selecting table falls through", () => {
    const content = "| A | B |\n|---|---|\n| 1 | 2 |";
    const view = createViewWithSelection(content, 0, content.length);
    const bounds = getSourceBlockBounds(view);

    expect(bounds).not.toBeNull();
    const { from, to } = view.state.selection.main;
    expect(from).toBe(bounds!.from);
    expect(to).toBe(bounds!.to);
    view.destroy();
  });

  it("blockquote: already selecting blockquote falls through", () => {
    const content = "> line one\n> line two";
    const view = createViewWithSelection(content, 0, content.length);
    const bounds = getSourceBlockBounds(view);

    expect(bounds).not.toBeNull();
    const { from, to } = view.state.selection.main;
    expect(from).toBe(bounds!.from);
    expect(to).toBe(bounds!.to);
    view.destroy();
  });

  it("list: already selecting list falls through", () => {
    const content = "- item one\n- item two";
    const view = createViewWithSelection(content, 0, content.length);
    const bounds = getSourceBlockBounds(view);

    expect(bounds).not.toBeNull();
    const { from, to } = view.state.selection.main;
    expect(from).toBe(bounds!.from);
    expect(to).toBe(bounds!.to);
    view.destroy();
  });
});

describe("edge cases", () => {
  it("empty code fence returns null", () => {
    const content = "```\n```";
    const view = createView(content, 2);
    const bounds = getSourceBlockBounds(view);
    expect(bounds).toBeNull();
    view.destroy();
  });

  it("mermaid fence treated same as any code fence", () => {
    const content = "```mermaid\nflowchart TD\n  A --> B\n```";
    const view = createView(content, 15);
    const bounds = getSourceBlockBounds(view);

    expect(bounds).not.toBeNull();
    view.destroy();
  });

  it("table with only header + separator (no data rows) is detected", () => {
    const content = "| H1 | H2 |\n|---|---|";
    const view = createView(content, 3);
    const bounds = getSourceBlockBounds(view);

    expect(bounds).not.toBeNull();
    expect(bounds!.from).toBe(0);
    expect(bounds!.to).toBe(content.length);
    view.destroy();
  });

  it("single-line blockquote", () => {
    const content = "> just one line";
    const view = createView(content, 5);
    const bounds = getSourceBlockBounds(view);

    expect(bounds).not.toBeNull();
    expect(bounds!.from).toBe(0);
    expect(bounds!.to).toBe(content.length);
    view.destroy();
  });

  it("blockquote at start of document", () => {
    const content = "> first\n> second\n\nParagraph";
    const view = createView(content, 3);
    const bounds = getSourceBlockBounds(view);

    expect(bounds).not.toBeNull();
    expect(bounds!.from).toBe(0);
    view.destroy();
  });

  it("list at end of document (no trailing newline)", () => {
    const content = "Paragraph\n\n- item";
    const listStart = content.indexOf("- item");
    const view = createView(content, listStart + 3);
    const bounds = getSourceBlockBounds(view);

    expect(bounds).not.toBeNull();
    expect(bounds!.to).toBe(content.length);
    view.destroy();
  });
});
