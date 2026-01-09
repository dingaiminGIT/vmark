/**
 * ProseMirror to MDAST conversion
 *
 * Converts ProseMirror document nodes to MDAST (Markdown Abstract Syntax Tree).
 * The ProseMirror schema is passed in to ensure framework-free utils layer.
 *
 * @module utils/markdownPipeline/proseMirrorToMdast
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
  ThematicBreak,
  Text,
  Strong,
  Emphasis,
  Delete,
  InlineCode,
  Link,
  Image,
  Break,
  PhrasingContent,
  BlockContent,
  FootnoteReference,
  FootnoteDefinition,
} from "mdast";
import type { InlineMath } from "mdast-util-math";
import type { Subscript, Superscript, Highlight, Underline } from "./types";

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
  constructor(_schema: Schema) {
    // Schema reserved for future use (custom node type detection)
  }

  /**
   * Convert ProseMirror doc to MDAST root.
   */
  convertDoc(doc: PMNode): Root {
    const children: Content[] = [];

    doc.forEach((child) => {
      const converted = this.convertNode(child);
      if (converted) {
        if (Array.isArray(converted)) {
          children.push(...converted);
        } else {
          children.push(converted);
        }
      }
    });

    return { type: "root", children };
  }

  /**
   * Convert a single ProseMirror node to MDAST node(s).
   */
  private convertNode(node: PMNode): Content | Content[] | null {
    const typeName = node.type.name;

    switch (typeName) {
      // Block nodes
      case "paragraph":
        return this.convertParagraph(node);
      case "heading":
        return this.convertHeading(node);
      case "codeBlock":
        return this.convertCodeBlock(node);
      case "blockquote":
        return this.convertBlockquote(node);
      case "bulletList":
        return this.convertList(node, false);
      case "orderedList":
        return this.convertList(node, true);
      case "listItem":
        return this.convertListItem(node);
      case "horizontalRule":
        return this.convertHorizontalRule();
      case "hardBreak":
        return this.convertHardBreak();
      case "image":
        return this.convertImage(node);

      // Custom nodes
      case "math_inline":
        return this.convertMathInline(node);
      case "footnote_reference":
        return this.convertFootnoteReference(node);
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

  // Block converters

  private convertParagraph(node: PMNode): Paragraph {
    const children = this.convertInlineContent(node);
    return { type: "paragraph", children };
  }

  private convertHeading(node: PMNode): Heading {
    const level = (node.attrs.level ?? 1) as 1 | 2 | 3 | 4 | 5 | 6;
    const children = this.convertInlineContent(node);
    return { type: "heading", depth: level, children };
  }

  private convertCodeBlock(node: PMNode): Code {
    const lang = node.attrs.language as string | null;
    return {
      type: "code",
      lang: lang || undefined,
      value: node.textContent,
    };
  }

  private convertBlockquote(node: PMNode): Blockquote {
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
    return { type: "blockquote", children };
  }

  private convertList(node: PMNode, ordered: boolean): List {
    const children: ListItem[] = [];
    node.forEach((child) => {
      const converted = this.convertNode(child);
      if (converted && !Array.isArray(converted) && converted.type === "listItem") {
        children.push(converted);
      }
    });

    const list: List = {
      type: "list",
      ordered,
      children,
    };

    if (ordered) {
      list.start = (node.attrs.start as number) ?? 1;
    }

    return list;
  }

  private convertListItem(node: PMNode): ListItem {
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

    const listItem: ListItem = { type: "listItem", children };

    // Handle task list items
    const checked = node.attrs.checked;
    if (checked === true || checked === false) {
      listItem.checked = checked;
    }

    return listItem;
  }

  private convertHorizontalRule(): ThematicBreak {
    return { type: "thematicBreak" };
  }

  private convertHardBreak(): Break {
    return { type: "break" };
  }

  private convertImage(node: PMNode): Image {
    return {
      type: "image",
      url: node.attrs.src as string,
      alt: (node.attrs.alt as string) || undefined,
      title: (node.attrs.title as string) || undefined,
    };
  }

  // Inline content conversion

  /**
   * Convert inline content of a block node to MDAST phrasing content.
   */
  private convertInlineContent(node: PMNode): PhrasingContent[] {
    const result: PhrasingContent[] = [];

    node.forEach((child) => {
      if (child.isText) {
        const converted = this.convertTextWithMarks(child);
        result.push(...converted);
      } else if (child.type.name === "hardBreak") {
        result.push({ type: "break" });
      } else if (child.type.name === "image") {
        const img = this.convertImage(child);
        result.push(img);
      } else if (child.type.name === "math_inline") {
        result.push(this.convertMathInline(child));
      } else if (child.type.name === "footnote_reference") {
        result.push(this.convertFootnoteReference(child));
      }
    });

    return result;
  }

  /**
   * Convert a text node with marks to nested MDAST inline nodes.
   */
  private convertTextWithMarks(node: PMNode): PhrasingContent[] {
    const text = node.text || "";
    if (!text) return [];

    const marks = node.marks;
    if (!marks.length) {
      return [{ type: "text", value: text } as Text];
    }

    // Build nested structure from marks
    // Start with text node, wrap with marks from innermost to outermost
    let content: PhrasingContent[] = [{ type: "text", value: text } as Text];

    for (const mark of marks) {
      content = this.wrapWithMark(content, mark);
    }

    return content;
  }

  /**
   * Wrap content with an MDAST mark node.
   */
  private wrapWithMark(content: PhrasingContent[], mark: Mark): PhrasingContent[] {
    const markName = mark.type.name;

    switch (markName) {
      case "bold":
        return [{ type: "strong", children: content } as Strong];
      case "italic":
        return [{ type: "emphasis", children: content } as Emphasis];
      case "strike":
        return [{ type: "delete", children: content } as Delete];
      case "code": {
        // Inline code wraps text directly
        const textContent = content
          .filter((c): c is Text => c.type === "text")
          .map((t) => t.value)
          .join("");
        return [{ type: "inlineCode", value: textContent } as InlineCode];
      }
      case "link":
        return [
          {
            type: "link",
            url: mark.attrs.href as string,
            children: content,
          } as Link,
        ];

      // Custom inline marks
      case "subscript":
        return [{ type: "subscript", children: content } as Subscript];
      case "superscript":
        return [{ type: "superscript", children: content } as Superscript];
      case "highlight":
        return [{ type: "highlight", children: content } as Highlight];
      case "underline":
        return [{ type: "underline", children: content } as Underline];

      default:
        // Unknown mark - return content as-is
        if (import.meta.env.DEV) {
          console.warn(`[PMToMdast] Unknown mark type: ${markName}`);
        }
        return content;
    }
  }

  // Custom node converters

  private convertMathInline(node: PMNode): InlineMath {
    return {
      type: "inlineMath",
      value: node.textContent,
    };
  }

  private convertFootnoteReference(node: PMNode): FootnoteReference {
    return {
      type: "footnoteReference",
      identifier: String(node.attrs.label ?? "1"),
      label: String(node.attrs.label ?? "1"),
    };
  }

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
}
