import { describe, expect, it } from "vitest";
import StarterKit from "@tiptap/starter-kit";
import { getSchema } from "@tiptap/core";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { highlightExtension } from "@/plugins/highlight/tiptap";
import { subscriptExtension, superscriptExtension } from "@/plugins/subSuperscript/tiptap";
import { alertBlockExtension } from "@/plugins/alertBlock/tiptap";
import { detailsBlockExtension, detailsSummaryExtension } from "@/plugins/detailsBlock/tiptap";
import { taskListItemExtension } from "@/plugins/taskToggle/tiptap";
import { footnoteDefinitionExtension, footnoteReferenceExtension } from "@/plugins/footnotePopup/tiptapNodes";
import { mathInlineExtension } from "@/plugins/latex/tiptapInlineMath";
import { parseMarkdownToTiptapDoc, serializeTiptapDocToMarkdown } from "./tiptapMarkdown";

const AlignedTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alignment: {
        default: null,
      },
    };
  },
});

const AlignedTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alignment: {
        default: null,
      },
    };
  },
});

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
    Image,
    Table.configure({ resizable: false }),
    TableRow,
    AlignedTableHeader,
    AlignedTableCell,
  ]);
}

describe("tiptapMarkdown table support", () => {
  it("round-trips a basic table", () => {
    const schema = createSchema();
    const input = ["| a | b |", "| --- | --- |", "| 1 | 2 |"].join("\n");

    const doc = parseMarkdownToTiptapDoc(schema, input);
    const output = serializeTiptapDocToMarkdown(doc).trim();

    expect(output).toBe(input);
  });

  it("preserves column alignment markers", () => {
    const schema = createSchema();
    const input = ["| a | b |", "| ---: | :--- |", "| 1 | 2 |"].join("\n");

    const doc = parseMarkdownToTiptapDoc(schema, input);
    const output = serializeTiptapDocToMarkdown(doc).trim();

    expect(output).toBe(input);
  });
});

describe("tiptapMarkdown inline mark support", () => {
  it("round-trips highlight/subscript/superscript", () => {
    const schema = createSchema();
    const input = "a ==hi== ~sub~ ^sup^ ~~strike~~";

    const doc = parseMarkdownToTiptapDoc(schema, input);
    const output = serializeTiptapDocToMarkdown(doc).trim();

    expect(output).toBe(input);
  });
});

describe("tiptapMarkdown alert/details support", () => {
  it("round-trips a GitHub-style alert block", () => {
    const schema = createSchema();
    const input = ["> [!NOTE]", "> hello"].join("\n");

    const doc = parseMarkdownToTiptapDoc(schema, input);
    const output = serializeTiptapDocToMarkdown(doc).trim();

    expect(output).toBe(input);
  });

  it("round-trips a details block", () => {
    const schema = createSchema();
    const input = ["<details>", "<summary>Click</summary>", "", "Hello **world**", "</details>"].join("\n");

    const doc = parseMarkdownToTiptapDoc(schema, input);
    const output = serializeTiptapDocToMarkdown(doc).trim();

    expect(output).toBe(input);
  });
});

describe("tiptapMarkdown task list support", () => {
  it("round-trips task list checkboxes", () => {
    const schema = createSchema();
    const input = ["- [ ] todo", "- [x] done"].join("\n");

    const doc = parseMarkdownToTiptapDoc(schema, input);
    const output = serializeTiptapDocToMarkdown(doc).trim();

    expect(output).toBe(input);
  });
});

describe("tiptapMarkdown footnote support", () => {
  it("round-trips footnote references + definitions", () => {
    const schema = createSchema();
    const input = ["Hello [^1]", "", "[^1]: note"].join("\n");

    const doc = parseMarkdownToTiptapDoc(schema, input);
    const output = serializeTiptapDocToMarkdown(doc).trim();

    expect(output).toBe(input);
  });
});

describe("tiptapMarkdown math support", () => {
  it("round-trips inline math", () => {
    const schema = createSchema();
    const input = "a $x^2$ b";

    const doc = parseMarkdownToTiptapDoc(schema, input);
    const output = serializeTiptapDocToMarkdown(doc).trim();

    expect(output).toBe(input);
  });

  it("normalizes $$ blocks to fenced latex code blocks", () => {
    const schema = createSchema();
    const input = ["$$", "E=mc^2", "$$"].join("\n");
    const expected = ["```latex", "E=mc^2", "```"].join("\n");

    const doc = parseMarkdownToTiptapDoc(schema, input);
    const output = serializeTiptapDocToMarkdown(doc).trim();

    expect(output).toBe(expected);
  });
});
