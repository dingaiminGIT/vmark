/**
 * Markdown pipeline adapter
 *
 * Provides a unified interface for parsing and serializing markdown,
 * with the ability to switch between the old markdown-it pipeline
 * and the new remark-based pipeline via a feature flag.
 *
 * @module utils/markdownPipeline/adapter
 *
 * @example
 * // Enable the remark pipeline
 * setUseRemarkPipeline(true);
 *
 * // Parse markdown to ProseMirror document
 * const doc = parseMarkdown(schema, "# Hello");
 *
 * // Serialize ProseMirror document to markdown
 * const md = serializeMarkdown(schema, doc);
 */

import type { Schema, Node as PMNode } from "@tiptap/pm/model";
import { parseMarkdownToMdast } from "./parser";
import { mdastToProseMirror } from "./mdastToProseMirror";
import { proseMirrorToMdast } from "./proseMirrorToMdast";
import { serializeMdastToMarkdown } from "./serializer";

// Feature flag for switching between pipelines
// Default to markdown-it (false) for backward compatibility
let useRemarkPipeline = false;

/**
 * Set whether to use the remark pipeline or the legacy markdown-it pipeline.
 *
 * @param enabled - If true, use remark; if false, use markdown-it
 *
 * @example
 * setUseRemarkPipeline(true); // Enable remark
 * setUseRemarkPipeline(false); // Use legacy markdown-it
 */
export function setUseRemarkPipeline(enabled: boolean): void {
  useRemarkPipeline = enabled;
}

/**
 * Get the current pipeline setting.
 *
 * @returns true if remark pipeline is enabled, false for markdown-it
 */
export function getUseRemarkPipeline(): boolean {
  return useRemarkPipeline;
}

/**
 * Parse markdown string to ProseMirror document.
 *
 * Uses either the remark or markdown-it pipeline based on the feature flag.
 *
 * @param schema - The ProseMirror schema to use for creating nodes
 * @param markdown - The markdown string to parse
 * @returns A ProseMirror document node
 *
 * @example
 * const doc = parseMarkdown(schema, "# Hello world");
 */
export function parseMarkdown(schema: Schema, markdown: string): PMNode {
  if (useRemarkPipeline) {
    return parseMarkdownWithRemark(schema, markdown);
  }
  return parseMarkdownWithMarkdownIt(schema, markdown);
}

/**
 * Serialize ProseMirror document to markdown string.
 *
 * Uses either the remark or markdown-it pipeline based on the feature flag.
 *
 * @param schema - The ProseMirror schema (used for type context)
 * @param doc - The ProseMirror document to serialize
 * @returns A markdown string
 *
 * @example
 * const md = serializeMarkdown(schema, doc);
 */
export function serializeMarkdown(schema: Schema, doc: PMNode): string {
  if (useRemarkPipeline) {
    return serializeMarkdownWithRemark(schema, doc);
  }
  return serializeMarkdownWithProseMirror(doc);
}

// Internal: Parse with remark pipeline
function parseMarkdownWithRemark(schema: Schema, markdown: string): PMNode {
  const mdast = parseMarkdownToMdast(markdown);
  return mdastToProseMirror(schema, mdast);
}

// Internal: Serialize with remark pipeline
function serializeMarkdownWithRemark(schema: Schema, doc: PMNode): string {
  const mdast = proseMirrorToMdast(schema, doc);
  return serializeMdastToMarkdown(mdast);
}

// Internal: Parse with legacy markdown-it pipeline
// Import dynamically to avoid circular dependencies
function parseMarkdownWithMarkdownIt(schema: Schema, markdown: string): PMNode {
  // Lazy import to avoid bundling markdown-it when not needed
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { parseMarkdownToTiptapDoc } = require("../tiptapMarkdownParser");
  return parseMarkdownToTiptapDoc(schema, markdown);
}

// Internal: Serialize with legacy prosemirror-markdown pipeline
function serializeMarkdownWithProseMirror(doc: PMNode): string {
  // Lazy import to avoid bundling prosemirror-markdown when not needed
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { serializeTiptapDocToMarkdown } = require("../tiptapMarkdownSerializer");
  return serializeTiptapDocToMarkdown(doc);
}
