/**
 * Terminal Markdown Plugin
 *
 * Detects and renders markdown in terminal output.
 */

export { createMarkdownDetector, MarkdownDetector } from "./markdownDetector";
export { renderBlocks, likelyContainsMarkdown, ANSI, BOX } from "./ansiRenderer";
export { createMarkdownAddon, MarkdownAddon } from "./xtermAddon";
export type {
  MarkdownBlockType,
  MarkdownBlock,
  DetectionResult,
  AnsiRenderOptions,
} from "./types";
