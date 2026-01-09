/**
 * Markdown parser using remark
 *
 * Parses markdown text into MDAST (Markdown Abstract Syntax Tree).
 * Uses unified with remark-parse, remark-gfm, remark-math, and remark-frontmatter.
 *
 * @module utils/markdownPipeline/parser
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkFrontmatter from "remark-frontmatter";
import type { Root } from "mdast";
import { remarkCustomInline } from "./plugins";

/**
 * Unified processor configured for VMark markdown parsing.
 *
 * Plugins:
 * - remark-parse: Base CommonMark parser
 * - remark-gfm: GitHub Flavored Markdown (tables, task lists, strikethrough, autolinks)
 * - remark-math: Inline ($...$) and block ($$...$$) math
 * - remark-frontmatter: YAML frontmatter (---)
 *
 * Custom inline syntax (==highlight==, ~sub~, ^sup^, ++underline++)
 * is handled via remarkCustomInline plugin.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm, {
    // Disable single tilde strikethrough to avoid conflict with subscript
    // GFM strikethrough uses ~~double tilde~~
    singleTilde: false,
  })
  .use(remarkMath)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkCustomInline);

/**
 * Parse markdown text into MDAST.
 *
 * @param markdown - The markdown text to parse
 * @returns The root MDAST node
 *
 * @example
 * const mdast = parseMarkdownToMdast("# Hello\n\nWorld");
 * // mdast.type === "root"
 * // mdast.children[0].type === "heading"
 * // mdast.children[1].type === "paragraph"
 */
export function parseMarkdownToMdast(markdown: string): Root {
  const result = processor.parse(markdown);
  // Run transforms (plugins that modify the tree)
  const transformed = processor.runSync(result);
  return transformed as Root;
}
