/**
 * Markdown Parsing Helpers for MCP Handlers
 *
 * Context-aware markdown parsing utilities that distinguish between
 * block-level and inline-level insertion contexts.
 *
 * Background:
 * - parseMarkdown() always produces block-level nodes (paragraphs, headings, etc.)
 * - Many insertion points are inline (inside existing paragraphs)
 * - Inserting block nodes at inline positions causes unwanted paragraph splits
 *
 * @module hooks/mcpBridge/markdownHelpers
 */

import type { Schema } from "@tiptap/pm/model";
import type { JSONContent } from "@tiptap/core";
import { parseMarkdown } from "@/utils/markdownPipeline";

/**
 * Parse markdown and extract inline content only.
 *
 * Use this for inline insertions where you're adding text within an existing
 * paragraph or text node. This prevents unwanted paragraph splits.
 *
 * Examples of inline contexts:
 * - Paragraph append/prepend operations
 * - Inline text replacements (find-and-replace)
 * - List item text updates
 * - Table cell content updates
 *
 * @param schema - ProseMirror schema
 * @param markdown - Markdown text to parse
 * @returns Array of inline content nodes (text, marks, etc.)
 *
 * @example
 * // Appending to a paragraph
 * const inlineNodes = parseInlineMarkdown(schema, " \\==highlighted text\\==");
 * editor.chain()
 *   .focus()
 *   .setTextSelection({ from: paragraphEnd - 1, to: paragraphEnd - 1 })
 *   .insertContent(inlineNodes) // Inserts inline, no paragraph split
 *   .run();
 */
export function parseInlineMarkdown(
  schema: Schema,
  markdown: string
): JSONContent[] {
  const parsedDoc = parseMarkdown(schema, markdown, { preserveLineBreaks: false });

  // Check for multi-paragraph content (data loss risk)
  if (parsedDoc.content.childCount > 1) {
    throw new Error(
      `parseInlineMarkdown: Multi-paragraph input detected (${parsedDoc.content.childCount} paragraphs). ` +
      `Inline context cannot handle multiple paragraphs. Content after first paragraph would be lost. ` +
      `Use parseBlockMarkdown() instead or ensure input is single-paragraph text.`
    );
  }

  // Extract inline content from the first paragraph
  const firstChild = parsedDoc.content.firstChild;

  if (!firstChild) {
    return [];
  }

  // If it's a paragraph, extract its inline content
  if (firstChild.type.name === "paragraph") {
    const inlineContent = firstChild.content;
    if (!inlineContent) {
      return [];
    }

    // Convert to JSON format
    const jsonContent: JSONContent[] = [];
    inlineContent.forEach((node) => {
      jsonContent.push(node.toJSON());
    });
    return jsonContent;
  }

  // If it's not a paragraph (e.g., heading, code block), this is likely
  // a misuse - the caller should use parseBlockMarkdown() instead.
  // Return empty to avoid breaking document structure.
  console.warn(
    `parseInlineMarkdown: Expected paragraph but got ${firstChild.type.name}. ` +
    `Consider using parseBlockMarkdown() for block-level content.`
  );
  return [];
}

/**
 * Parse markdown to block-level nodes.
 *
 * Use this for block-level insertions where you're adding new structural
 * elements (paragraphs, headings, sections, etc.) at block positions.
 *
 * Examples of block contexts:
 * - Section insert operations
 * - Section update operations (replacing section content)
 * - Smart insert (end/start of document, after sections)
 * - Batch insert operations
 *
 * @param schema - ProseMirror schema
 * @param markdown - Markdown text to parse
 * @returns Array of block-level content nodes
 *
 * @example
 * // Inserting a new section
 * const blockNodes = parseBlockMarkdown(schema, "## New Section\n\nContent here");
 * editor.chain()
 *   .focus()
 *   .setTextSelection(insertPos)
 *   .insertContent(blockNodes) // Inserts as block-level structure
 *   .run();
 */
export function parseBlockMarkdown(
  schema: Schema,
  markdown: string
): JSONContent[] {
  const parsedDoc = parseMarkdown(schema, markdown, { preserveLineBreaks: false });
  return parsedDoc.content.toJSON();
}

