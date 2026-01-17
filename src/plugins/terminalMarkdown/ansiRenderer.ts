/**
 * ANSI Renderer
 *
 * Renders markdown blocks as styled ANSI escape sequences for terminal display.
 */

import type { MarkdownBlock, AnsiRenderOptions } from "./types";

// ANSI escape codes
const ANSI = {
  // Reset
  RESET: "\x1b[0m",

  // Text styles
  BOLD: "\x1b[1m",
  DIM: "\x1b[2m",
  ITALIC: "\x1b[3m",
  UNDERLINE: "\x1b[4m",

  // Colors (foreground)
  BLACK: "\x1b[30m",
  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  MAGENTA: "\x1b[35m",
  CYAN: "\x1b[36m",
  WHITE: "\x1b[37m",
  GRAY: "\x1b[90m",

  // Bright colors
  BRIGHT_RED: "\x1b[91m",
  BRIGHT_GREEN: "\x1b[92m",
  BRIGHT_YELLOW: "\x1b[93m",
  BRIGHT_BLUE: "\x1b[94m",
  BRIGHT_MAGENTA: "\x1b[95m",
  BRIGHT_CYAN: "\x1b[96m",
  BRIGHT_WHITE: "\x1b[97m",

  // Background colors
  BG_BLACK: "\x1b[40m",
  BG_RED: "\x1b[41m",
  BG_GREEN: "\x1b[42m",
  BG_YELLOW: "\x1b[43m",
  BG_BLUE: "\x1b[44m",
  BG_MAGENTA: "\x1b[45m",
  BG_CYAN: "\x1b[46m",
  BG_WHITE: "\x1b[47m",
  BG_GRAY: "\x1b[100m",
};

// Unicode box drawing characters
const BOX = {
  H_LINE: "─",
  V_LINE: "│",
  TOP_LEFT: "┌",
  TOP_RIGHT: "┐",
  BOTTOM_LEFT: "└",
  BOTTOM_RIGHT: "┘",
  BULLET: "●",
  ARROW: "▶",
  BLOCK: "▌",
};

/**
 * Render a single markdown block as ANSI
 */
function renderBlock(block: MarkdownBlock, options: AnsiRenderOptions = {}): string {
  const width = options.termWidth ?? 80;

  switch (block.type) {
    case "heading":
      return renderHeading(block, width);

    case "codeBlock":
      return renderCodeBlock(block, width, options);

    case "list":
      return renderListItem(block);

    case "blockquote":
      return renderBlockquote(block);

    case "horizontalRule":
      return renderHorizontalRule(width);

    case "paragraph":
    default:
      return block.content;
  }
}

/**
 * Render heading with color and prefix indicator
 */
function renderHeading(block: MarkdownBlock, _width: number): string {
  const level = block.level ?? 1;
  const prefix = BOX.BLOCK;

  // Different colors for different heading levels
  const colors = [
    ANSI.BRIGHT_CYAN,    // H1
    ANSI.BRIGHT_GREEN,   // H2
    ANSI.BRIGHT_YELLOW,  // H3
    ANSI.BRIGHT_BLUE,    // H4
    ANSI.BRIGHT_MAGENTA, // H5
    ANSI.GRAY,           // H6
  ];

  const color = colors[Math.min(level - 1, colors.length - 1)];

  return `${color}${ANSI.BOLD}${prefix} ${block.content}${ANSI.RESET}`;
}

/**
 * Render code block with borders
 */
function renderCodeBlock(
  block: MarkdownBlock,
  width: number,
  options: AnsiRenderOptions
): string {
  const lines: string[] = [];
  const contentWidth = Math.max(width - 4, 20);
  const lang = block.language || "";

  // Top border with optional language tag
  const langTag = options.showLanguage !== false && lang ? ` ${lang} ` : "";
  const topBorder = BOX.H_LINE.repeat(Math.max(contentWidth - langTag.length, 10));
  lines.push(`${ANSI.DIM}${topBorder}${langTag ? `${ANSI.BRIGHT_BLUE}${langTag}${ANSI.RESET}${ANSI.DIM}` : ""}${ANSI.RESET}`);

  // Code content
  const codeLines = block.content.split("\n");
  for (const codeLine of codeLines) {
    lines.push(`${ANSI.DIM}  ${ANSI.RESET}${codeLine}`);
  }

  // Bottom border
  lines.push(`${ANSI.DIM}${BOX.H_LINE.repeat(contentWidth)}${ANSI.RESET}`);

  return lines.join("\n");
}

/**
 * Render list item with bullet or number
 */
function renderListItem(block: MarkdownBlock): string {
  if (block.listType === "ordered") {
    // Ordered list
    return `${ANSI.BRIGHT_BLUE}  ${BOX.ARROW}${ANSI.RESET} ${block.content}`;
  } else {
    // Bullet list
    return `${ANSI.GREEN}  ${BOX.BULLET}${ANSI.RESET} ${block.content}`;
  }
}

/**
 * Render blockquote with vertical bar
 */
function renderBlockquote(block: MarkdownBlock): string {
  return `${ANSI.DIM}${BOX.V_LINE}${ANSI.RESET} ${ANSI.ITALIC}${block.content}${ANSI.RESET}`;
}

/**
 * Render horizontal rule
 */
function renderHorizontalRule(width: number): string {
  return `${ANSI.DIM}${BOX.H_LINE.repeat(Math.max(width - 4, 20))}${ANSI.RESET}`;
}

/**
 * Render multiple blocks
 */
export function renderBlocks(blocks: MarkdownBlock[], options: AnsiRenderOptions = {}): string {
  return blocks.map((block) => renderBlock(block, options)).join("\n");
}

/**
 * Check if text likely contains markdown
 * Quick heuristic check before full parsing
 */
export function likelyContainsMarkdown(text: string): boolean {
  // Check for common markdown patterns
  return (
    /^#{1,6}\s/.test(text) ||        // Heading
    /^```/.test(text) ||              // Code fence
    /^[-*]\s/.test(text) ||           // Bullet list
    /^\d+\.\s/.test(text) ||          // Ordered list
    /^>\s/.test(text) ||              // Blockquote
    /^(-{3,}|_{3,}|\*{3,})$/.test(text) // HR
  );
}

export { ANSI, BOX };
