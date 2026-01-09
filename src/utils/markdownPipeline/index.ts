/**
 * Markdown Pipeline
 *
 * Remark-based markdown parsing and serialization for VMark.
 * Provides MDAST as the intermediate representation between
 * markdown text and ProseMirror documents.
 *
 * @module utils/markdownPipeline
 *
 * @example
 * // Parse markdown to MDAST
 * const mdast = parseMarkdownToMdast("# Hello");
 *
 * // Serialize MDAST back to markdown
 * const md = serializeMdastToMarkdown(mdast);
 */

// Core parsing/serialization
export { parseMarkdownToMdast } from "./parser";
export { serializeMdastToMarkdown } from "./serializer";

// MDAST ↔ ProseMirror conversion
export { mdastToProseMirror } from "./mdastToProseMirror";
export { proseMirrorToMdast } from "./proseMirrorToMdast";

// Types
export * from "./types";
