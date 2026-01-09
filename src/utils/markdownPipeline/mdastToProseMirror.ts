/**
 * MDAST to ProseMirror conversion
 *
 * Converts MDAST (Markdown Abstract Syntax Tree) nodes to ProseMirror nodes.
 * The ProseMirror schema is passed in to ensure framework-free utils layer.
 *
 * @module utils/markdownPipeline/mdastToProseMirror
 */

import type { Schema, Node as PMNode, Mark } from "@tiptap/pm/model";
import type {
  Root,
  Content,
  Paragraph,
  Heading,
  Code,
  Definition,
  Blockquote,
  List,
  ListItem,
  Table,
  Html,
  Text,
  Strong,
  Emphasis,
  Delete,
  InlineCode,
  Link,
  LinkReference,
  Image,
  FootnoteReference,
  FootnoteDefinition,
} from "mdast";
import type { InlineMath, Math } from "mdast-util-math";
import type {
  Alert,
  Details,
  Subscript,
  Superscript,
  Highlight,
  Underline,
  WikiLink,
  WikiEmbed,
  Yaml,
} from "./types";
import * as inlineConverters from "./mdastInlineConverters";
import { escapeHtml } from "@/utils/sanitize";
import {
  convertAlert,
  convertBlockquote,
  convertCode,
  convertDefinition,
  convertDetails,
  convertFootnoteDefinition,
  convertFrontmatter,
  convertHeading,
  convertHtml,
  convertList,
  convertListItem,
  convertMathBlock,
  convertParagraph,
  convertTable,
  convertThematicBreak,
  convertWikiEmbed,
  convertWikiLink,
  type ContentContext,
  type MdastToPmContext,
} from "./mdastBlockConverters";

/**
 * Convert MDAST root to ProseMirror document.
 *
 * @param schema - The ProseMirror schema to use for creating nodes
 * @param mdast - The MDAST root node
 * @returns A ProseMirror document node
 *
 * @example
 * const mdast = parseMarkdownToMdast("# Hello");
 * const doc = mdastToProseMirror(schema, mdast);
 */
export function mdastToProseMirror(schema: Schema, mdast: Root): PMNode {
  const converter = new MdastToPMConverter(schema);
  return converter.convertRoot(mdast);
}

/**
 * Internal converter class that maintains schema context.
 */
class MdastToPMConverter {
  private context: MdastToPmContext;

  constructor(private schema: Schema) {
    this.context = {
      schema,
      convertChildren: this.convertChildren.bind(this),
    };
  }

  /**
   * Convert root node to ProseMirror doc.
   */
  convertRoot(root: Root): PMNode {
    const children = this.convertChildren(root.children, [], "block");
    return this.schema.topNodeType.create(null, children);
  }

  /**
   * Convert array of MDAST children to ProseMirror nodes.
   * Accepts Content[] or PhrasingContent[] (inline content).
   */
  convertChildren(
    children: readonly Content[],
    marks: Mark[],
    context: ContentContext
  ): PMNode[] {
    const result: PMNode[] = [];
    const normalizedChildren = context === "inline" ? mergeInlineHtmlTags(children) : children;
    for (const child of normalizedChildren) {
      const converted = this.convertNode(child, marks, context);
      if (converted) {
        if (Array.isArray(converted)) {
          result.push(...converted);
        } else {
          result.push(converted);
        }
      }
    }
    return result;
  }

  /**
   * Convert a single MDAST node to ProseMirror node(s).
   */
  private convertNode(
    node: Content,
    marks: Mark[],
    context: "block" | "inline"
  ): PMNode | PMNode[] | null {
    // Use type assertion for node.type to handle custom types not in base Content union
    const nodeType = node.type as string;
    const convertInlineChildren = (children: readonly Content[], nextMarks: Mark[]) =>
      this.convertChildren(children, nextMarks, "inline");

    switch (nodeType) {
      // Block nodes
      case "paragraph":
        return convertParagraph(this.context, node as Paragraph, marks);
      case "heading":
        return convertHeading(this.context, node as Heading, marks);
      case "code":
        return convertCode(this.context, node as Code);
      case "blockquote":
        return convertBlockquote(this.context, node as Blockquote, marks);
      case "list":
        return convertList(this.context, node as List, marks);
      case "listItem":
        return convertListItem(this.context, node as ListItem, marks);
      case "thematicBreak":
        return convertThematicBreak(this.context);
      case "table":
        return convertTable(this.context, node as Table, marks);
      case "math":
        return convertMathBlock(this.context, node as Math);
      case "definition":
        return convertDefinition(this.context, node as Definition);
      case "details":
        return convertDetails(this.context, node as Details, marks);

      // Inline nodes - delegated to inline converters
      case "text":
        return inlineConverters.convertText(this.schema, node as Text, marks);
      case "strong":
        return inlineConverters.convertStrong(this.schema, node as Strong, marks, convertInlineChildren);
      case "emphasis":
        return inlineConverters.convertEmphasis(this.schema, node as Emphasis, marks, convertInlineChildren);
      case "delete":
        return inlineConverters.convertDelete(this.schema, node as Delete, marks, convertInlineChildren);
      case "inlineCode":
        return inlineConverters.convertInlineCode(this.schema, node as InlineCode, marks);
      case "link":
        return inlineConverters.convertLink(this.schema, node as Link, marks, convertInlineChildren);
      case "image":
        return inlineConverters.convertImage(this.schema, node as Image);
      case "break":
        return inlineConverters.convertBreak(this.schema);
      case "linkReference":
        return this.convertLinkReference(node as LinkReference, marks);

      // Custom inline marks
      case "subscript":
        return inlineConverters.convertSubscript(this.schema, node as unknown as Subscript, marks, convertInlineChildren);
      case "superscript":
        return inlineConverters.convertSuperscript(this.schema, node as unknown as Superscript, marks, convertInlineChildren);
      case "highlight":
        return inlineConverters.convertHighlight(this.schema, node as unknown as Highlight, marks, convertInlineChildren);
      case "underline":
        return inlineConverters.convertUnderline(this.schema, node as unknown as Underline, marks, convertInlineChildren);

      // Custom nodes
      case "inlineMath":
        return inlineConverters.convertInlineMath(this.schema, node as unknown as InlineMath);
      case "footnoteReference":
        return inlineConverters.convertFootnoteReference(this.schema, node as unknown as FootnoteReference);
      case "footnoteDefinition":
        return convertFootnoteDefinition(this.context, node as unknown as FootnoteDefinition, marks);
      case "wikiLink":
        return convertWikiLink(this.context, node as unknown as WikiLink);
      case "wikiEmbed":
        return convertWikiEmbed(this.context, node as unknown as WikiEmbed);
      case "alert":
        return convertAlert(this.context, node as Alert, marks);
      case "html":
        return convertHtml(this.context, node as Html, context === "inline");

      case "yaml":
        return convertFrontmatter(this.context, node as Yaml);

      default:
        // Unknown node type - skip with warning in dev
        if (import.meta.env.DEV) {
          console.warn(`[MdastToPM] Unknown node type: ${nodeType}`);
        }
        return null;
    }
  }

  private convertLinkReference(node: LinkReference, marks: Mark[]): PMNode | null {
    const type = this.schema.nodes.link_reference;
    if (!type) return null;
    const children = this.convertChildren(node.children as Content[], marks, "inline");
    return type.create(
      {
        identifier: node.identifier,
        label: node.label ?? null,
        referenceType: node.referenceType ?? "full",
      },
      children
    );
  }
}

const INLINE_HTML_OPEN_RE = /^<([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>$/;
const INLINE_HTML_CLOSE_RE = /^<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>$/;

function mergeInlineHtmlTags(children: readonly Content[]): Content[] {
  const result: Content[] = [];

  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];
    if (node.type !== "html") {
      result.push(node);
      continue;
    }

    const openTag = parseInlineHtmlOpen(node.value ?? "");
    if (!openTag) {
      result.push(node);
      continue;
    }

    let depth = 1;
    const innerNodes: Content[] = [];
    let closeIndex = -1;

    for (let cursor = index + 1; cursor < children.length; cursor += 1) {
      const next = children[cursor];
      if (next.type === "html") {
        const nextValue = String(next.value ?? "");
        if (isInlineHtmlOpen(nextValue, openTag)) {
          depth += 1;
          innerNodes.push(next);
          continue;
        }
        if (isInlineHtmlClose(nextValue, openTag)) {
          depth -= 1;
          if (depth === 0) {
            closeIndex = cursor;
            break;
          }
          innerNodes.push(next);
          continue;
        }
      }
      innerNodes.push(next);
    }

    if (closeIndex !== -1) {
      const closeNode = children[closeIndex] as Html;
      const mergedValue = `${String(node.value ?? "")}${serializeInlineHtmlNodes(innerNodes)}${String(closeNode.value ?? "")}`;
      result.push({ type: "html", value: mergedValue } as Html);
      index = closeIndex;
      continue;
    }

    result.push(node);
  }

  return result;
}

function parseInlineHtmlOpen(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("<") || trimmed.startsWith("</") || trimmed.endsWith("/>")) {
    return null;
  }
  const match = trimmed.match(INLINE_HTML_OPEN_RE);
  return match ? match[1].toLowerCase() : null;
}

function isInlineHtmlOpen(value: string, tagName: string): boolean {
  const openTag = parseInlineHtmlOpen(value);
  return openTag === tagName.toLowerCase();
}

function isInlineHtmlClose(value: string, tagName: string): boolean {
  const match = value.trim().match(INLINE_HTML_CLOSE_RE);
  return match ? match[1].toLowerCase() === tagName.toLowerCase() : false;
}

function serializeInlineHtmlNodes(nodes: Content[]): string {
  let value = "";
  for (const node of nodes) {
    value += serializeInlineHtmlNode(node);
  }
  return value;
}

function serializeInlineHtmlNode(node: Content): string {
  switch (node.type) {
    case "text":
      return escapeHtml((node as Text).value ?? "");
    case "html":
      return String((node as Html).value ?? "");
    case "break":
      return "<br>";
    default:
      if ("children" in node && Array.isArray(node.children)) {
        return serializeInlineHtmlNodes(node.children as Content[]);
      }
      return "";
  }
}
