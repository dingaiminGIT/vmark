import { MarkdownParser } from "prosemirror-markdown";
import type { Schema, Node as PMNode } from "@tiptap/pm/model";
import { createVmarkMarkdownIt } from "./markdownItVmark";
import { patchTokenHandlers, type TokenHandler } from "./tiptapMarkdownTokenHandlers";

const markdownIt = createVmarkMarkdownIt();
const parserCache = new WeakMap<Schema, MarkdownParser>();

function normalizeMathBlocks(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    const singleLine = trimmed.match(/^\$\$(.+)\$\$$/);
    if (singleLine) {
      out.push("```latex");
      out.push(String(singleLine[1] ?? "").trim());
      out.push("```");
      continue;
    }

    if (trimmed.startsWith("$$")) {
      const first = trimmed === "$$" ? "" : trimmed.slice(2).trimStart();
      const contentLines: string[] = [];
      if (first) contentLines.push(first);

      while (i + 1 < lines.length) {
        const next = lines[i + 1] ?? "";
        if (next.trim() === "$$") {
          i++;
          break;
        }
        contentLines.push(next);
        i++;
      }

      out.push("```latex");
      out.push(...contentLines);
      out.push("```");
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

function extractFootnoteDefinitions(markdown: string): { main: string; defs: Array<{ label: string; content: string }> } {
  const lines = markdown.split(/\r?\n/);
  const mainLines: string[] = [];
  const defs: Array<{ label: string; content: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const match = line.match(/^\[\^([^\]]+)\]:\s*(.*)$/);
    if (!match) {
      mainLines.push(line);
      continue;
    }

    const label = String(match[1] ?? "").trim();
    const parts: string[] = [String(match[2] ?? "")];

    while (i + 1 < lines.length) {
      const next = lines[i + 1] ?? "";
      const cont = next.match(/^(?: {4}|\t)(.*)$/);
      if (cont) {
        parts.push(String(cont[1] ?? ""));
        i++;
        continue;
      }
      if (next.trim().length === 0) {
        i++;
        continue;
      }
      break;
    }

    const content = parts.join(" ").replace(/\s+/g, " ").trim();
    if (label) defs.push({ label, content });
  }

  return { main: mainLines.join("\n"), defs };
}

export function parseMarkdownToTiptapDoc(schema: Schema, markdown: string): PMNode {
  const cached = parserCache.get(schema);
  const normalized = normalizeMathBlocks(markdown);
  const { main, defs } = extractFootnoteDefinitions(normalized);
  if (cached) {
    const baseDoc = cached.parse(main) as PMNode;
    if (defs.length === 0) return baseDoc;

    const defType = schema.nodes.footnote_definition;
    const paragraphType = schema.nodes.paragraph;
    if (!defType || !paragraphType) return baseDoc;

    const blocks: PMNode[] = [];
    baseDoc.content.forEach((child) => blocks.push(child as PMNode));

    for (const def of defs) {
      const paragraph = def.content ? paragraphType.create(null, schema.text(def.content)) : paragraphType.create();
      blocks.push(defType.create({ label: def.label }, [paragraph]) as PMNode);
    }

    return schema.topNodeType.create(null, blocks) as PMNode;
  }

  const parser = new MarkdownParser(schema, markdownIt, {
    blockquote: { block: "blockquote" },
    paragraph: { block: "paragraph" },
    html_block: { ignore: true, noCloseToken: true },
    html_inline: { ignore: true, noCloseToken: true },
    heading: {
      block: "heading",
      getAttrs: (tok) => ({ level: +tok.tag.slice(1) }),
    },
    bullet_list: { block: "bulletList" },
    ordered_list: {
      block: "orderedList",
      getAttrs: (tok) => ({
        start: +(tok.attrGet("start") || 1),
        type: tok.attrGet("type") || null,
      }),
    },
    list_item: { block: "listItem" },
    code_block: { block: "codeBlock", noCloseToken: true },
    fence: {
      block: "codeBlock",
      getAttrs: (tok) => ({ language: tok.info?.trim() || null }),
      noCloseToken: true,
    },
    hr: { node: "horizontalRule" },
    image: {
      node: "image",
      getAttrs: (tok) => ({
        src: tok.attrGet("src"),
        title: tok.attrGet("title") || null,
        alt: (tok.children?.[0]?.content || tok.attrGet("alt") || null) ?? null,
      }),
    },
    hardbreak: { node: "hardBreak" },
    em: { mark: "italic" },
    strong: { mark: "bold" },
    s: { mark: "strike" },
    highlight: { mark: "highlight" },
    subscript: { mark: "subscript" },
    superscript: { mark: "superscript" },
    math_inline: { block: "math_inline", noCloseToken: true },
    footnote_reference: {
      node: "footnote_reference",
      getAttrs: (tok) => ({ label: tok.attrGet("label") }),
    },
    link: {
      mark: "link",
      getAttrs: (tok) => ({
        href: tok.attrGet("href"),
        target: null,
        rel: null,
        class: null,
      }),
    },
    code_inline: { mark: "code", noCloseToken: true },
    table: { block: "table" },
    thead: { ignore: true },
    tbody: { ignore: true },
    tr: { block: "tableRow" },
    th: { ignore: true },
    td: { ignore: true },
  });

  const handlers = (parser as unknown as { tokenHandlers: Record<string, TokenHandler> }).tokenHandlers;
  patchTokenHandlers(handlers);

  parserCache.set(schema, parser);
  const baseDoc = parser.parse(main) as PMNode;
  if (defs.length === 0) return baseDoc;

  const defType = schema.nodes.footnote_definition;
  const paragraphType = schema.nodes.paragraph;
  if (!defType || !paragraphType) return baseDoc;

  const blocks: PMNode[] = [];
  baseDoc.content.forEach((child) => blocks.push(child as PMNode));

  for (const def of defs) {
    const paragraph = def.content ? paragraphType.create(null, schema.text(def.content)) : paragraphType.create();
    blocks.push(defType.create({ label: def.label }, [paragraph]) as PMNode);
  }

  return schema.topNodeType.create(null, blocks) as PMNode;
}
