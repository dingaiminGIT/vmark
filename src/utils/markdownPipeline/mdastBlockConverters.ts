import type { Schema, Node as PMNode, Mark } from "@tiptap/pm/model";
import type {
  Blockquote,
  Code,
  Content,
  Definition,
  Heading,
  Html,
  List,
  ListItem,
  Paragraph,
  Table,
} from "mdast";
import type { Math } from "mdast-util-math";
import type { Alert, Details, WikiEmbed, WikiLink, Yaml } from "./types";
import * as inlineConverters from "./mdastInlineConverters";
export type ContentContext = "block" | "inline";

export interface MdastToPmContext {
  schema: Schema;
  convertChildren: (children: readonly Content[], marks: Mark[], context: ContentContext) => PMNode[];
}
const ALERT_TYPES = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;

export function convertParagraph(
  context: MdastToPmContext,
  node: Paragraph,
  marks: Mark[]
): PMNode | null {
  const type = context.schema.nodes.paragraph;
  if (!type) return null;
  const blockImageType = context.schema.nodes.block_image;
  if (blockImageType && node.children.length === 1 && node.children[0]?.type === "image") {
    const imageNode = inlineConverters.convertImage(
      context.schema,
      node.children[0] as import("mdast").Image
    );
    if (imageNode) {
      return blockImageType.create({
        src: imageNode.attrs.src ?? "",
        alt: imageNode.attrs.alt ?? "",
        title: imageNode.attrs.title ?? "",
      });
    }
  }
  const children = context.convertChildren(node.children as Content[], marks, "inline");
  return type.create(null, children);
}

export function convertHeading(
  context: MdastToPmContext,
  node: Heading,
  marks: Mark[]
): PMNode | null {
  const type = context.schema.nodes.heading;
  if (!type) return null;
  const children = context.convertChildren(node.children as Content[], marks, "inline");
  return type.create({ level: node.depth }, children);
}

export function convertCode(context: MdastToPmContext, node: Code): PMNode | null {
  const type = context.schema.nodes.codeBlock;
  if (!type) return null;

  const text = node.value ? context.schema.text(node.value) : null;
  return type.create({ language: node.lang || null }, text ? [text] : []);
}

export function convertBlockquote(
  context: MdastToPmContext,
  node: Blockquote,
  marks: Mark[]
): PMNode | null {
  const alertNode = convertAlertBlockquote(context, node, marks);
  if (alertNode) return alertNode;

  const type = context.schema.nodes.blockquote;
  if (!type) return null;

  const children = context.convertChildren(node.children, marks, "block");
  return type.create(null, children);
}

export function convertList(context: MdastToPmContext, node: List, marks: Mark[]): PMNode | null {
  const isOrdered = node.ordered ?? false;
  const typeName = isOrdered ? "orderedList" : "bulletList";
  const type = context.schema.nodes[typeName];
  if (!type) return null;

  const children = context.convertChildren(node.children, marks, "block");
  const attrs = isOrdered ? { start: node.start ?? 1 } : null;
  return type.create(attrs, children);
}

export function convertListItem(
  context: MdastToPmContext,
  node: ListItem,
  marks: Mark[]
): PMNode | null {
  const type = context.schema.nodes.listItem;
  if (!type) return null;

  const checked = node.checked;
  const attrs = checked !== null && checked !== undefined ? { checked } : null;

  const children = context.convertChildren(node.children, marks, "block");
  return type.create(attrs, children);
}

export function convertThematicBreak(context: MdastToPmContext): PMNode | null {
  const type = context.schema.nodes.horizontalRule;
  if (!type) return null;
  return type.create();
}

export function convertTable(
  context: MdastToPmContext,
  node: Table,
  marks: Mark[]
): PMNode | null {
  const tableType = context.schema.nodes.table;
  const rowType = context.schema.nodes.tableRow;
  const cellType = context.schema.nodes.tableCell;
  if (!tableType || !rowType || !cellType) return null;

  const headerType = context.schema.nodes.tableHeader ?? cellType;
  const paragraphType = context.schema.nodes.paragraph;
  const alignments = node.align ?? [];

  const rows = node.children.map((row, rowIndex) => {
    const cells = row.children.map((cell, cellIndex) => {
      const cellNodeType = rowIndex === 0 ? headerType : cellType;
      const alignment = alignments[cellIndex] ?? null;
      const attrs = alignment && supportsAlignmentAttr(cellNodeType) ? { alignment } : null;
      const inlineChildren = context.convertChildren(cell.children as Content[], marks, "inline");
      const content = paragraphType ? [paragraphType.create(null, inlineChildren)] : inlineChildren;
      return cellNodeType.create(attrs, content);
    });
    return rowType.create(null, cells);
  });

  return tableType.create(null, rows);
}

/**
 * Internal sentinel value for math blocks stored as codeBlock.
 * Uses a value that won't collide with real language names.
 */
export const MATH_BLOCK_LANGUAGE = "$$math$$";

export function convertMathBlock(context: MdastToPmContext, node: Math): PMNode | null {
  const type = context.schema.nodes.codeBlock;
  if (!type) return null;
  const text = node.value ? context.schema.text(node.value) : null;
  return type.create({ language: MATH_BLOCK_LANGUAGE }, text ? [text] : []);
}

export function convertDefinition(context: MdastToPmContext, node: Definition): PMNode | null {
  const type = context.schema.nodes.link_definition;
  if (!type) return null;
  return type.create({
    identifier: node.identifier,
    label: node.label ?? null,
    url: node.url,
    title: node.title ?? null,
  });
}

export function convertFrontmatter(context: MdastToPmContext, node: Yaml): PMNode | null {
  const type = context.schema.nodes.frontmatter;
  if (!type) return null;
  return type.create({ value: node.value ?? "" });
}

export function convertDetails(
  context: MdastToPmContext,
  node: Details,
  marks: Mark[]
): PMNode | null {
  const detailsType = context.schema.nodes.detailsBlock;
  const summaryType = context.schema.nodes.detailsSummary;
  if (!detailsType || !summaryType) return null;

  const summaryText = node.summary ?? "Details";
  const summaryNode = summaryType.create(
    null,
    summaryText ? [context.schema.text(summaryText)] : []
  );
  const children = context.convertChildren(node.children as Content[], marks, "block");
  if (children.length === 0 && context.schema.nodes.paragraph) {
    children.push(context.schema.nodes.paragraph.create());
  }

  return detailsType.create({ open: node.open ?? false }, [summaryNode, ...children]);
}

export function convertAlert(
  context: MdastToPmContext,
  node: Alert,
  marks: Mark[]
): PMNode | null {
  const alertType = context.schema.nodes.alertBlock;
  if (!alertType) return null;

  const children = context.convertChildren(node.children as Content[], marks, "block");
  if (children.length === 0 && context.schema.nodes.paragraph) {
    children.push(context.schema.nodes.paragraph.create());
  }

  return alertType.create({ alertType: node.alertType }, children);
}

export function convertWikiLink(context: MdastToPmContext, node: WikiLink): PMNode | null {
  const type = context.schema.nodes.wikiLink;
  if (!type) return null;
  return type.create({ value: node.value, alias: node.alias ?? null });
}

export function convertWikiEmbed(context: MdastToPmContext, node: WikiEmbed): PMNode | null {
  const type = context.schema.nodes.wikiEmbed;
  if (!type) return null;
  return type.create({ value: node.value, alias: node.alias ?? null });
}

export function convertHtml(
  context: MdastToPmContext,
  node: Html,
  inline: boolean
): PMNode | null {
  const type = inline ? context.schema.nodes.html_inline : context.schema.nodes.html_block;
  if (!type) return null;
  return type.create({ value: node.value ?? "" });
}

export function convertFootnoteDefinition(
  context: MdastToPmContext,
  node: import("mdast").FootnoteDefinition,
  marks: Mark[]
): PMNode | null {
  const type = context.schema.nodes.footnote_definition;
  if (!type) return null;

  const children = context.convertChildren(node.children, marks, "block");
  return type.create({ label: node.identifier }, children);
}

export function convertAlertBlockquote(
  context: MdastToPmContext,
  node: Blockquote,
  marks: Mark[]
): PMNode | null {
  const alertType = context.schema.nodes.alertBlock;
  if (!alertType) return null;

  const firstChild = node.children[0];
  if (!firstChild || firstChild.type !== "paragraph") return null;

  const stripped = stripAlertMarker(firstChild);
  if (!stripped) return null;

  const alertChildren: Content[] = [];
  if (stripped.paragraph) {
    alertChildren.push(stripped.paragraph);
  }
  alertChildren.push(...node.children.slice(1));

  const converted = context.convertChildren(alertChildren, marks, "block");
  if (converted.length === 0 && context.schema.nodes.paragraph) {
    converted.push(context.schema.nodes.paragraph.create());
  }

  return alertType.create({ alertType: stripped.alertType }, converted);
}

function stripAlertMarker(
  paragraph: Paragraph
): { alertType: (typeof ALERT_TYPES)[number]; paragraph: Paragraph | null } | null {
  const children = [...(paragraph.children ?? [])];
  const first = children[0];
  if (!first || first.type !== "text") return null;

  const match = first.value.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s+)?/i);
  if (!match) return null;

  const alertType = match[1].toUpperCase();
  if (!ALERT_TYPES.includes(alertType as (typeof ALERT_TYPES)[number])) {
    return null;
  }
  const rest = first.value.slice(match[0].length);

  if (rest.length > 0) {
    children[0] = { ...first, value: rest };
  } else {
    children.shift();
  }

  if (children[0]?.type === "break") {
    children.shift();
  }

  const nextParagraph = children.length > 0 ? { ...paragraph, children } : null;
  return { alertType: alertType as (typeof ALERT_TYPES)[number], paragraph: nextParagraph };
}

function supportsAlignmentAttr(nodeType: { spec?: { attrs?: Record<string, unknown> } }): boolean {
  const attrs = nodeType.spec?.attrs;
  return Boolean(attrs && "alignment" in attrs);
}
