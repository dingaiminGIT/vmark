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
  Blockquote,
  List,
  ListItem,
  Text,
  Strong,
  Emphasis,
  Delete,
  InlineCode,
  Link,
  Image,
  FootnoteReference,
  FootnoteDefinition,
} from "mdast";
import type { InlineMath } from "mdast-util-math";
import type { Subscript, Superscript, Highlight, Underline } from "./types";

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
  constructor(private schema: Schema) {}

  /**
   * Convert root node to ProseMirror doc.
   */
  convertRoot(root: Root): PMNode {
    const children = this.convertChildren(root.children, []);
    return this.schema.topNodeType.create(null, children);
  }

  /**
   * Convert array of MDAST children to ProseMirror nodes.
   * Accepts Content[] or PhrasingContent[] (inline content).
   */
  private convertChildren(children: readonly Content[], marks: Mark[]): PMNode[] {
    const result: PMNode[] = [];
    for (const child of children) {
      const converted = this.convertNode(child, marks);
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
  private convertNode(node: Content, marks: Mark[]): PMNode | PMNode[] | null {
    // Use type assertion for node.type to handle custom types not in base Content union
    const nodeType = node.type as string;

    switch (nodeType) {
      // Block nodes
      case "paragraph":
        return this.convertParagraph(node as Paragraph, marks);
      case "heading":
        return this.convertHeading(node as Heading, marks);
      case "code":
        return this.convertCode(node as Code);
      case "blockquote":
        return this.convertBlockquote(node as Blockquote, marks);
      case "list":
        return this.convertList(node as List, marks);
      case "listItem":
        return this.convertListItem(node as ListItem, marks);
      case "thematicBreak":
        return this.convertThematicBreak();

      // Inline nodes
      case "text":
        return this.convertText(node as Text, marks);
      case "strong":
        return this.convertStrong(node as Strong, marks);
      case "emphasis":
        return this.convertEmphasis(node as Emphasis, marks);
      case "delete":
        return this.convertDelete(node as Delete, marks);
      case "inlineCode":
        return this.convertInlineCode(node as InlineCode, marks);
      case "link":
        return this.convertLink(node as Link, marks);

      // Custom inline marks
      case "subscript":
        return this.convertSubscript(node as unknown as Subscript, marks);
      case "superscript":
        return this.convertSuperscript(node as unknown as Superscript, marks);
      case "highlight":
        return this.convertHighlight(node as unknown as Highlight, marks);
      case "underline":
        return this.convertUnderline(node as unknown as Underline, marks);
      case "image":
        return this.convertImage(node as Image);
      case "break":
        return this.convertBreak();

      // Custom nodes
      case "inlineMath":
        return this.convertInlineMath(node as unknown as InlineMath);
      case "footnoteReference":
        return this.convertFootnoteReference(node as unknown as FootnoteReference);
      case "footnoteDefinition":
        return this.convertFootnoteDefinition(
          node as unknown as FootnoteDefinition,
          marks
        );

      // Skip frontmatter and other non-content nodes
      case "yaml":
        return null;

      default:
        // Unknown node type - skip with warning in dev
        if (import.meta.env.DEV) {
          console.warn(`[MdastToPM] Unknown node type: ${nodeType}`);
        }
        return null;
    }
  }

  // Block converters

  private convertParagraph(node: Paragraph, marks: Mark[]): PMNode | null {
    const type = this.schema.nodes.paragraph;
    if (!type) return null;

    const children = this.convertChildren(node.children as Content[], marks);
    return type.create(null, children);
  }

  private convertHeading(node: Heading, marks: Mark[]): PMNode | null {
    const type = this.schema.nodes.heading;
    if (!type) return null;

    const children = this.convertChildren(node.children as Content[], marks);
    return type.create({ level: node.depth }, children);
  }

  private convertCode(node: Code): PMNode | null {
    const type = this.schema.nodes.codeBlock;
    if (!type) return null;

    const text = node.value ? this.schema.text(node.value) : null;
    return type.create({ language: node.lang || null }, text ? [text] : []);
  }

  private convertBlockquote(node: Blockquote, marks: Mark[]): PMNode | null {
    const type = this.schema.nodes.blockquote;
    if (!type) return null;

    const children = this.convertChildren(node.children, marks);
    return type.create(null, children);
  }

  private convertList(node: List, marks: Mark[]): PMNode | null {
    const isOrdered = node.ordered ?? false;
    const typeName = isOrdered ? "orderedList" : "bulletList";
    const type = this.schema.nodes[typeName];
    if (!type) return null;

    const children = this.convertChildren(node.children, marks);
    const attrs = isOrdered ? { start: node.start ?? 1 } : null;
    return type.create(attrs, children);
  }

  private convertListItem(node: ListItem, marks: Mark[]): PMNode | null {
    const type = this.schema.nodes.listItem;
    if (!type) return null;

    // Handle task list items
    const checked = node.checked;
    const attrs = checked !== null && checked !== undefined ? { checked } : null;

    // ListItem children are typically block-level (paragraphs, nested lists)
    const children = this.convertChildren(node.children, marks);
    return type.create(attrs, children);
  }

  private convertThematicBreak(): PMNode | null {
    const type = this.schema.nodes.horizontalRule;
    if (!type) return null;
    return type.create();
  }

  // Inline converters

  private convertText(node: Text, marks: Mark[]): PMNode | null {
    if (!node.value) return null;
    return this.schema.text(node.value, marks);
  }

  private convertStrong(node: Strong, marks: Mark[]): PMNode[] {
    const markType = this.schema.marks.bold;
    if (!markType) {
      return this.convertChildren(node.children as Content[], marks);
    }
    const newMarks = [...marks, markType.create()];
    return this.convertChildren(node.children as Content[], newMarks);
  }

  private convertEmphasis(node: Emphasis, marks: Mark[]): PMNode[] {
    const markType = this.schema.marks.italic;
    if (!markType) {
      return this.convertChildren(node.children as Content[], marks);
    }
    const newMarks = [...marks, markType.create()];
    return this.convertChildren(node.children as Content[], newMarks);
  }

  private convertDelete(node: Delete, marks: Mark[]): PMNode[] {
    const markType = this.schema.marks.strike;
    if (!markType) {
      return this.convertChildren(node.children as Content[], marks);
    }
    const newMarks = [...marks, markType.create()];
    return this.convertChildren(node.children as Content[], newMarks);
  }

  private convertInlineCode(node: InlineCode, marks: Mark[]): PMNode | null {
    const markType = this.schema.marks.code;
    if (!markType) {
      return this.schema.text(node.value, marks);
    }
    const newMarks = [...marks, markType.create()];
    return this.schema.text(node.value, newMarks);
  }

  private convertLink(node: Link, marks: Mark[]): PMNode[] {
    const markType = this.schema.marks.link;
    if (!markType) {
      return this.convertChildren(node.children as Content[], marks);
    }
    const newMarks = [...marks, markType.create({ href: node.url })];
    return this.convertChildren(node.children as Content[], newMarks);
  }

  private convertImage(node: Image): PMNode | null {
    const type = this.schema.nodes.image;
    if (!type) return null;

    return type.create({
      src: node.url,
      alt: node.alt || null,
      title: node.title || null,
    });
  }

  private convertBreak(): PMNode | null {
    const type = this.schema.nodes.hardBreak;
    if (!type) return null;
    return type.create();
  }

  // Custom node converters

  private convertInlineMath(node: InlineMath): PMNode | null {
    const type = this.schema.nodes.math_inline;
    if (!type) return null;

    const text = node.value ? this.schema.text(node.value) : null;
    return type.create(null, text ? [text] : []);
  }

  private convertFootnoteReference(node: FootnoteReference): PMNode | null {
    const type = this.schema.nodes.footnote_reference;
    if (!type) return null;

    return type.create({ label: node.identifier });
  }

  private convertFootnoteDefinition(
    node: FootnoteDefinition,
    marks: Mark[]
  ): PMNode | null {
    const type = this.schema.nodes.footnote_definition;
    if (!type) return null;

    const children = this.convertChildren(node.children, marks);
    return type.create({ label: node.identifier }, children);
  }

  // Custom inline mark converters

  private convertSubscript(node: Subscript, marks: Mark[]): PMNode[] {
    const markType = this.schema.marks.subscript;
    if (!markType) {
      return this.convertChildren(node.children as Content[], marks);
    }
    const newMarks = [...marks, markType.create()];
    return this.convertChildren(node.children as Content[], newMarks);
  }

  private convertSuperscript(node: Superscript, marks: Mark[]): PMNode[] {
    const markType = this.schema.marks.superscript;
    if (!markType) {
      return this.convertChildren(node.children as Content[], marks);
    }
    const newMarks = [...marks, markType.create()];
    return this.convertChildren(node.children as Content[], newMarks);
  }

  private convertHighlight(node: Highlight, marks: Mark[]): PMNode[] {
    const markType = this.schema.marks.highlight;
    if (!markType) {
      return this.convertChildren(node.children as Content[], marks);
    }
    const newMarks = [...marks, markType.create()];
    return this.convertChildren(node.children as Content[], newMarks);
  }

  private convertUnderline(node: Underline, marks: Mark[]): PMNode[] {
    const markType = this.schema.marks.underline;
    if (!markType) {
      return this.convertChildren(node.children as Content[], marks);
    }
    const newMarks = [...marks, markType.create()];
    return this.convertChildren(node.children as Content[], newMarks);
  }
}
