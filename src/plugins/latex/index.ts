/**
 * LaTeX Plugin
 *
 * Adds math/LaTeX support to the editor:
 * - Inline math: $E=mc^2$
 * - Block math: $$ ... $$ or ```latex code blocks
 *
 * Uses KaTeX for rendering and remark-math for parsing.
 */

import type { KatexOptions } from "katex";
import katex from "katex";
import { escapeHtml } from "@/utils/sanitize";

export interface LatexConfig {
  katexOptions?: KatexOptions;
}

/**
 * Render LaTeX content to HTML using KaTeX.
 */
export function renderLatex(
  content: string,
  options?: KatexOptions
): string {
  try {
    return katex.renderToString(content, {
      ...options,
      throwOnError: false,
      displayMode: true,
    });
  } catch {
    return `<pre class="math-error">${escapeHtml(content)}</pre>`;
  }
}

// Note: Use these plugins individually with .use() in the editor chain
// Each plugin needs to be added separately as they return different Milkdown types

// Re-export individual components for advanced usage
export { mathInlineSchema, mathInlineId } from "./inline-latex";
export { blockLatexSchema } from "./block-latex";
export { mathBlockSchema, mathBlockId } from "./math-block-schema";
export { mathBlockView } from "./math-block-view";
export { mathBlockKeymap } from "./math-block-keymap";
export { mathInlineView, mathInlineCursorPlugin } from "./math-inline-view";
export { mathInlineInputRule, mathBlockInputRule } from "./input-rule";
export { remarkMathPlugin } from "./remark";
export { mathInlinePlugin } from "./math-inline-plugin";
