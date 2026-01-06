import { MarkdownSerializer } from "prosemirror-markdown";
import type { Node as PMNode } from "@tiptap/pm/model";

function backticksFor(node: PMNode, side: number) {
  const ticks = /`+/g;
  let match: RegExpExecArray | null;
  let len = 0;
  if (node.isText) {
    while ((match = ticks.exec(node.text || ""))) {
      len = Math.max(len, match[0].length);
    }
  }
  let result = len > 0 && side > 0 ? " `" : "`";
  for (let i = 0; i < len; i++) result += "`";
  if (len > 0 && side < 0) result += " ";
  return result;
}

const tiptapMarkdownSerializer = new MarkdownSerializer(
  {
    alertBlock: (state, node) => {
      const alertType = (node.attrs.alertType as string | undefined) ?? "NOTE";
      state.wrapBlock("> ", null, node, () => {
        state.write(`[!${alertType}]`);
        state.ensureNewLine();
        state.renderContent(node);
      });
    },
    detailsBlock: (state, node) => {
      const openAttr = node.attrs.open ? " open" : "";
      const summaryNode = node.firstChild;
      const summaryText = summaryNode?.type.name === "detailsSummary" ? summaryNode.textContent : "Details";
      const escapeHtml = (text: string) =>
        text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

      state.write(`<details${openAttr}>`);
      state.write("\n");
      state.write(`<summary>${escapeHtml(summaryText || "Details")}</summary>`);
      state.write("\n\n");

      for (let i = 1; i < node.childCount; i++) {
        state.render(node.child(i), node, i);
      }

      (state as unknown as { flushClose: (size?: number) => void }).flushClose(1);
      state.write("</details>");
      state.closeBlock(node);
    },
    footnote_reference: (state, node) => {
      const label = String(node.attrs.label ?? "");
      state.write(`[^${label}]`);
    },
    footnote_definition: (state, node) => {
      const label = String(node.attrs.label ?? "");
      state.write(`[^${label}]: `);
      const paragraph = node.firstChild;
      if (paragraph) {
        state.renderInline(paragraph, false);
      }
      state.closeBlock(node);
    },
    blockquote: (state, node) => {
      state.wrapBlock("> ", null, node, () => state.renderContent(node));
    },
    codeBlock: (state, node) => {
      const backticks = node.textContent.match(/`{3,}/gm);
      const fence = backticks ? `${backticks.sort().slice(-1)[0]}\`` : "```";
      const language = node.attrs.language ? node.attrs.language : "";
      state.write(`${fence}${language}\n`);
      state.text(node.textContent, false);
      state.write("\n");
      state.write(fence);
      state.closeBlock(node);
    },
    heading: (state, node) => {
      state.write(`${state.repeat("#", node.attrs.level)} `);
      state.renderInline(node, false);
      state.closeBlock(node);
    },
    horizontalRule: (state, node) => {
      state.write("---");
      state.closeBlock(node);
    },
    bulletList: (state, node) => {
      state.renderList(node, "  ", (index) => {
        const item = node.child(index);
        const checked = item.attrs.checked as unknown;
        if (checked === true) return "- [x] ";
        if (checked === false) return "- [ ] ";
        return "- ";
      });
    },
    orderedList: (state, node) => {
      const start = node.attrs.start || 1;
      const maxW = String(start + node.childCount - 1).length;
      const space = state.repeat(" ", maxW + 2);
      state.renderList(node, space, (i) => {
        const nStr = String(start + i);
        return `${state.repeat(" ", maxW - nStr.length)}${nStr}. `;
      });
    },
    listItem: (state, node) => {
      state.renderContent(node);
    },
    math_inline: (state, node) => {
      const content = String(node.textContent ?? "").replace(/\$/g, "\\$").replace(/\n/g, " ");
      state.write(`$${content}$`);
    },
    paragraph: (state, node) => {
      state.renderInline(node);
      state.closeBlock(node);
    },
    image: (state, node) => {
      state.write(
        `![${state.esc(node.attrs.alt || "")}](${node.attrs.src.replace(/[()]/g, "\\$&")}${node.attrs.title ? ` "${node.attrs.title.replace(/"/g, '\\"')}"` : ""})`
      );
    },
    block_image: (state, node) => {
      state.write(
        `![${state.esc(node.attrs.alt || "")}](${node.attrs.src.replace(/[()]/g, "\\$&")}${node.attrs.title ? ` "${node.attrs.title.replace(/"/g, '\\"')}"` : ""})`
      );
      state.closeBlock(node);
    },
    hardBreak: (state, node, parent, index) => {
      for (let i = index + 1; i < parent.childCount; i++) {
        if (parent.child(i).type !== node.type) {
          state.write("\\\n");
          return;
        }
      }
    },
    table: (state, node) => {
      if (node.childCount === 0) return;

      const rows: string[][] = [];
      let maxCols = 0;

      for (let r = 0; r < node.childCount; r++) {
        const row = node.child(r);
        const cells: string[] = [];
        for (let c = 0; c < row.childCount; c++) {
          const cell = row.child(c);
          const paragraph = cell.firstChild;
          const inline = paragraph ? tiptapMarkdownSerializer.serialize(paragraph) : cell.textContent;
          const normalized = inline.replace(/\\\n/g, " ").replace(/\n/g, " ").trim();
          cells.push(normalized);
        }
        maxCols = Math.max(maxCols, cells.length);
        rows.push(cells);
      }

      const markerFor = (alignment: unknown) => {
        if (alignment === "left") return ":---";
        if (alignment === "center") return ":---:";
        if (alignment === "right") return "---:";
        return "---";
      };

      const headerRow = rows[0] ?? [];
      while (headerRow.length < maxCols) headerRow.push("");
      state.write(`| ${headerRow.join(" | ")} |`);
      state.write("\n");

      const separator: string[] = [];
      const firstRowNode = node.child(0);
      for (let c = 0; c < maxCols; c++) {
        const firstRowCell = c < firstRowNode.childCount ? firstRowNode.child(c) : null;
        separator.push(markerFor(firstRowCell?.attrs?.alignment));
      }
      state.write(`| ${separator.join(" | ")} |`);
      state.write("\n");

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r] ?? [];
        while (row.length < maxCols) row.push("");
        state.write(`| ${row.join(" | ")} |`);
        if (r < rows.length - 1) state.write("\n");
      }

      state.closeBlock(node);
    },
    text: (state, node) => {
      state.text(node.text || "", true);
    },
  },
  {
    italic: { open: "*", close: "*", mixable: true, expelEnclosingWhitespace: true },
    bold: { open: "**", close: "**", mixable: true, expelEnclosingWhitespace: true },
    strike: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true },
    highlight: { open: "==", close: "==", mixable: true, expelEnclosingWhitespace: true },
    subscript: { open: "~", close: "~", mixable: true, expelEnclosingWhitespace: true },
    superscript: { open: "^", close: "^", mixable: true, expelEnclosingWhitespace: true },
    link: {
      open: () => "[",
      close: (_state, mark) => `](${mark.attrs.href.replace(/[()"]/g, "\\$&")})`,
      mixable: true,
    },
    code: {
      open: (_state, _mark, parent, index) => backticksFor(parent.child(index), -1),
      close: (_state, _mark, parent, index) => backticksFor(parent.child(index - 1), 1),
      escape: false,
    },
  },
  { escapeExtraCharacters: /[|]/g }
);

export function serializeTiptapDocToMarkdown(doc: PMNode): string {
  return tiptapMarkdownSerializer.serialize(doc, { tightLists: true });
}
