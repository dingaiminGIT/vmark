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

export { mathInlineExtension } from "./tiptapInlineMath";
