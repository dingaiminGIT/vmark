/**
 * ProseMirror to MDAST conversion
 *
 * Converts ProseMirror document nodes to MDAST (Markdown Abstract Syntax Tree).
 * The ProseMirror schema is passed in to ensure framework-free utils layer.
 *
 * @module utils/markdownPipeline/proseMirrorToMdast
 */

import type { Schema, Node as PMNode } from "@tiptap/pm/model";
import type {
  Root,
  Content,
  PhrasingContent,
  BlockContent,
  LinkReference,
  Html,
} from "mdast";
import type { FootnoteDefinition, WikiEmbed, WikiLink } from "./types";
import * as inlineConverters from "./pmInlineConverters";
import {
  convertAlertBlock,
  convertBlockImage,
  convertBlockquote,
  convertCodeBlock,
  convertDefinition,
  convertDetailsBlock,
  convertFrontmatter,
  convertHeading,
  convertHorizontalRule,
  convertHtmlBlock,
  convertList,
  convertListItem,
  convertParagraph,
  convertTable,
  type PmToMdastContext,
  type PmToMdastNode,
} from "./pmBlockConverters";

/**
 * Convert ProseMirror document to MDAST root.
 *
 * @param schema - The ProseMirror schema (used for type checking)
 * @param doc - The ProseMirror document node
 * @returns An MDAST root node
 *
 * @example
 * const doc = editor.state.doc;
 * const mdast = proseMirrorToMdast(schema, doc);
 * const markdown = serializeMdastToMarkdown(mdast);
 */
export function proseMirrorToMdast(schema: Schema, doc: PMNode): Root {
  const converter = new PMToMdastConverter(schema);
  return converter.convertDoc(doc);
}

/**
 * Internal converter class for PM to MDAST conversion.
 * Schema parameter reserved for future extension (e.g., custom node detection).
 */
class PMToMdastConverter {
  private context: PmToMdastContext;

  constructor(_schema: Schema) {
    this.context = {
      convertNode: this.convertNode.bind(this),
      convertInlineContent: this.convertInlineContent.bind(this),
    };
  }

  /**
   * Convert ProseMirror doc to MDAST root.
   */
  convertDoc(doc: PMNode): Root {
    const children: Content[] = [];
    const pushRootContent = (node: PmToMdastNode) => {
      if (node.type !== "listItem") {
        children.push(node);
      }
    };

    doc.forEach((child) => {
      const converted = this.convertNode(child);
      if (converted) {
        if (Array.isArray(converted)) {
          converted.forEach((node) => pushRootContent(node));
        } else {
          pushRootContent(converted);
        }
      }
    });

    return { type: "root", children };
  }

  /**
   * Convert a single ProseMirror node to MDAST node(s).
   */
  private convertNode(node: PMNode): PmToMdastNode | PmToMdastNode[] | null {
    const typeName = node.type.name;

    switch (typeName) {
      // Block nodes
      case "paragraph":
        return convertParagraph(this.context, node);
      case "heading":
        return convertHeading(this.context, node);
      case "codeBlock":
        return convertCodeBlock(node);
      case "blockquote":
        return convertBlockquote(this.context, node);
      case "alertBlock":
        return convertAlertBlock(this.context, node);
      case "detailsBlock":
        return convertDetailsBlock(this.context, node);
      case "bulletList":
        return convertList(this.context, node, false);
      case "orderedList":
        return convertList(this.context, node, true);
      case "listItem":
        return convertListItem(this.context, node);
      case "horizontalRule":
        return convertHorizontalRule();
      case "table":
        return convertTable(this.context, node);
      case "block_image":
        return convertBlockImage(node);
      case "frontmatter":
        return convertFrontmatter(node);
      case "link_definition":
        return convertDefinition(node);
      case "html_block":
        return convertHtmlBlock(node);
      case "hardBreak":
        return inlineConverters.convertHardBreak();
      case "image":
        return inlineConverters.convertImage(node);

      // Custom nodes
      case "math_inline":
        return inlineConverters.convertMathInline(node);
      case "footnote_reference":
        return inlineConverters.convertFootnoteReference(node);
      case "footnote_definition":
        return this.convertFootnoteDefinition(node);

      default:
        // Unknown node type - skip with warning in dev
        if (import.meta.env.DEV) {
          console.warn(`[PMToMdast] Unknown node type: ${typeName}`);
        }
        return null;
    }
  }

  // Inline content conversion

  /**
   * Convert inline content of a block node to MDAST phrasing content.
   */
  private convertInlineContent(node: PMNode): PhrasingContent[] {
    const result: PhrasingContent[] = [];

    node.forEach((child) => {
      if (child.isText) {
        const converted = inlineConverters.convertTextWithMarks(child);
        result.push(...converted);
      } else if (child.type.name === "hardBreak") {
        result.push(inlineConverters.convertHardBreak());
      } else if (child.type.name === "image") {
        result.push(inlineConverters.convertImage(child));
      } else if (child.type.name === "math_inline") {
        result.push(inlineConverters.convertMathInline(child));
      } else if (child.type.name === "footnote_reference") {
        result.push(inlineConverters.convertFootnoteReference(child));
      } else if (child.type.name === "wikiLink") {
        result.push(this.convertWikiLink(child));
      } else if (child.type.name === "wikiEmbed") {
        result.push(this.convertWikiEmbed(child));
      } else if (child.type.name === "link_reference") {
        result.push(this.convertLinkReference(child));
      } else if (child.type.name === "html_inline") {
        result.push(this.convertHtmlInline(child));
      }
    });

    return result;
  }

  // Custom node converters

  private convertFootnoteDefinition(node: PMNode): FootnoteDefinition {
    const children: BlockContent[] = [];
    node.forEach((child) => {
      const converted = this.convertNode(child);
      if (converted) {
        if (Array.isArray(converted)) {
          children.push(...(converted as BlockContent[]));
        } else {
          children.push(converted as BlockContent);
        }
      }
    });

    return {
      type: "footnoteDefinition",
      identifier: String(node.attrs.label ?? "1"),
      label: String(node.attrs.label ?? "1"),
      children,
    };
  }

  private convertLinkReference(node: PMNode): LinkReference {
    return {
      type: "linkReference",
      identifier: String(node.attrs.identifier ?? ""),
      label: node.attrs.label ? String(node.attrs.label) : undefined,
      referenceType: (node.attrs.referenceType ?? "full") as "full" | "collapsed" | "shortcut",
      children: this.convertInlineContent(node),
    };
  }

  private convertWikiLink(node: PMNode): WikiLink {
    // Extract text content as alias
    let alias: string | undefined;
    if (node.content.size > 0) {
      alias = node.textContent;
    }

    const value = String(node.attrs.value ?? "");

    // Only include alias if it differs from value
    return {
      type: "wikiLink",
      value,
      alias: alias && alias !== value ? alias : undefined,
    };
  }

  private convertWikiEmbed(node: PMNode): WikiEmbed {
    return {
      type: "wikiEmbed",
      value: String(node.attrs.value ?? ""),
      alias: node.attrs.alias ? String(node.attrs.alias) : undefined,
    };
  }

  private convertHtmlInline(node: PMNode): Html {
    return { type: "html", value: String(node.attrs.value ?? "") };
  }
}
