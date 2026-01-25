import { describe, expect, it, vi } from "vitest";
import StarterKit from "@tiptap/starter-kit";
import { getSchema } from "@tiptap/core";
import { Table, TableRow } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { EditorState, NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { parseMarkdown } from "@/utils/markdownPipeline";
import { highlightExtension } from "@/plugins/highlight/tiptap";
import { subscriptExtension, superscriptExtension } from "@/plugins/subSuperscript/tiptap";
import { alertBlockExtension } from "@/plugins/alertBlock/tiptap";
import { detailsBlockExtension, detailsSummaryExtension } from "@/plugins/detailsBlock/tiptap";
import { taskListItemExtension } from "@/plugins/taskToggle/tiptap";
import { blockImageExtension } from "@/plugins/blockImage/tiptap";
import { footnoteDefinitionExtension, footnoteReferenceExtension } from "@/plugins/footnotePopup/tiptapNodes";
import { mathInlineExtension } from "@/plugins/latex/tiptapInlineMath";
import { AlignedTableCell, AlignedTableHeader } from "@/components/Editor/alignedTableNodes";
import {
  createSourcePeekSlice,
  getSourcePeekRange,
  serializeSourcePeekRange,
  applySourcePeekMarkdown,
  getSourcePeekAnchorRect,
} from "./sourcePeek";

function createSchema() {
  return getSchema([
    StarterKit.configure({ listItem: false }),
    taskListItemExtension,
    highlightExtension,
    subscriptExtension,
    superscriptExtension,
    mathInlineExtension,
    alertBlockExtension,
    detailsSummaryExtension,
    detailsBlockExtension,
    footnoteReferenceExtension,
    footnoteDefinitionExtension,
    Image.configure({ inline: true }),
    blockImageExtension,
    Table.configure({ resizable: false }),
    TableRow,
    AlignedTableHeader,
    AlignedTableCell,
  ]);
}

describe("sourcePeek helpers", () => {
  it("builds a top-level block range for the selection", () => {
    const schema = createSchema();
    const doc = parseMarkdown(schema, "Alpha\n\nBeta");
    const selection = TextSelection.create(doc, 1);
    const state = EditorState.create({ doc, selection });

    const range = getSourcePeekRange(state);
    const slice = doc.slice(range.from, range.to);

    expect(slice.content.childCount).toBe(1);
    expect(slice.content.firstChild?.textContent).toBe("Alpha");
  });

  it("serializes the selection range to markdown", () => {
    const schema = createSchema();
    const doc = parseMarkdown(schema, "Alpha\n\nBeta");
    const selection = TextSelection.create(doc, 1);
    const state = EditorState.create({ doc, selection });

    const range = getSourcePeekRange(state);
    const markdown = serializeSourcePeekRange(state, range).trim();

    expect(markdown).toBe("Alpha");
  });

  it("creates a slice with a paragraph when markdown is empty", () => {
    const schema = createSchema();
    const slice = createSourcePeekSlice(schema, "");

    expect(slice.content.childCount).toBe(1);
    expect(slice.content.firstChild?.type.name).toBe("paragraph");
  });

  it("uses node selection bounds for block selections", () => {
    const schema = createSchema();
    const blockImage = schema.nodes.block_image.create({ src: "image.png", alt: "", title: "" });
    const doc = schema.nodes.doc.create(null, [blockImage]);
    const selection = NodeSelection.create(doc, 0);
    const state = EditorState.create({ doc, selection });

    const range = getSourcePeekRange(state);

    expect(range).toEqual({ from: selection.from, to: selection.to });
  });

  it("creates a slice with inline content wrapped in paragraph", () => {
    const schema = createSchema();
    // Create slice from inline content by parsing markdown with inline formatting
    const slice = createSourcePeekSlice(schema, "**bold text**");

    expect(slice.content.childCount).toBe(1);
    expect(slice.content.firstChild?.type.name).toBe("paragraph");
    expect(slice.content.firstChild?.textContent).toBe("bold text");
  });

  it("preserves block content without wrapping", () => {
    const schema = createSchema();
    const slice = createSourcePeekSlice(schema, "# Heading\n\nParagraph");

    // Should have heading and paragraph as separate blocks
    expect(slice.content.childCount).toBe(2);
    expect(slice.content.firstChild?.type.name).toBe("heading");
    expect(slice.content.child(1).type.name).toBe("paragraph");
  });

  it("serializes multi-paragraph selection correctly", () => {
    const schema = createSchema();
    const doc = parseMarkdown(schema, "First paragraph\n\nSecond paragraph");
    // Select text spanning from first to second paragraph
    const selection = TextSelection.create(doc, 1, doc.content.size - 1);
    const state = EditorState.create({ doc, selection });

    const range = getSourcePeekRange(state);
    const markdown = serializeSourcePeekRange(state, range).trim();

    expect(markdown).toContain("First paragraph");
    expect(markdown).toContain("Second paragraph");
  });

  it("handles shallow selection (depth < 1)", () => {
    const schema = createSchema();
    const doc = parseMarkdown(schema, "Test");
    // Create a selection at document level (depth 0)
    const state = EditorState.create({
      doc,
      selection: TextSelection.create(doc, 0, doc.content.size),
    });

    const range = getSourcePeekRange(state);

    // Should fall back to selection from/to
    expect(range.from).toBe(0);
    expect(range.to).toBe(doc.content.size);
  });
});

describe("getSourcePeekAnchorRect", () => {
  it("returns null when coordsAtPos throws", () => {
    const mockView = {
      coordsAtPos: vi.fn(() => {
        throw new Error("Position not valid");
      }),
    } as unknown as EditorView;

    const result = getSourcePeekAnchorRect(mockView, { from: 0, to: 10 });

    expect(result).toBeNull();
  });

  it("calculates correct bounding rect from view coordinates", () => {
    const mockView = {
      coordsAtPos: vi.fn((pos: number) => {
        if (pos === 0) {
          return { top: 100, left: 50, right: 150, bottom: 120 };
        }
        // to - 1 = 9
        return { top: 100, left: 100, right: 200, bottom: 120 };
      }),
    } as unknown as EditorView;

    const result = getSourcePeekAnchorRect(mockView, { from: 0, to: 10 });

    expect(result).toEqual({
      top: 100,
      left: 50,
      right: 200,
      bottom: 120,
    });
  });

  it("handles same from and to position", () => {
    const mockView = {
      coordsAtPos: vi.fn(() => ({
        top: 100,
        left: 50,
        right: 60,
        bottom: 120,
      })),
    } as unknown as EditorView;

    const result = getSourcePeekAnchorRect(mockView, { from: 5, to: 5 });

    expect(result).toEqual({
      top: 100,
      left: 50,
      right: 60,
      bottom: 120,
    });
  });
});

describe("applySourcePeekMarkdown", () => {
  it("returns true on successful application", () => {
    const schema = createSchema();
    const doc = parseMarkdown(schema, "Original text");
    const state = EditorState.create({ doc });

    const mockDispatch = vi.fn();
    const mockView = {
      state,
      dispatch: mockDispatch,
    } as unknown as EditorView;

    const result = applySourcePeekMarkdown(mockView, { from: 1, to: 14 }, "New text");

    expect(result).toBe(true);
    expect(mockDispatch).toHaveBeenCalled();
  });

  it("returns false and logs error on failure", () => {
    const schema = createSchema();
    const doc = parseMarkdown(schema, "Text");
    const state = EditorState.create({ doc });

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockView = {
      state,
      dispatch: vi.fn(() => {
        throw new Error("Dispatch failed");
      }),
    } as unknown as EditorView;

    const result = applySourcePeekMarkdown(mockView, { from: 0, to: 5 }, "New");

    expect(result).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      "[SourcePeek] Failed to apply markdown:",
      expect.any(Error)
    );

    consoleError.mockRestore();
  });
});
