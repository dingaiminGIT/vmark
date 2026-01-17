/**
 * Terminal Markdown Plugin Types
 */

/** Block types that can be detected in markdown output */
export type MarkdownBlockType =
  | "heading"
  | "codeBlock"
  | "list"
  | "blockquote"
  | "paragraph"
  | "horizontalRule";

/** Detected markdown block */
export interface MarkdownBlock {
  type: MarkdownBlockType;
  content: string;
  /** Heading level (1-6) for heading blocks */
  level?: number;
  /** Language identifier for code blocks */
  language?: string;
  /** List type for list blocks */
  listType?: "bullet" | "ordered";
  /** Original raw text before processing */
  raw: string;
}

/** Result of markdown detection */
export interface DetectionResult {
  /** Detected complete blocks ready for rendering */
  blocks: MarkdownBlock[];
  /** Remaining incomplete text (buffered for next chunk) */
  incomplete: string;
}

/** Options for ANSI rendering */
export interface AnsiRenderOptions {
  /** Terminal width for wrapping (default: 80) */
  termWidth?: number;
  /** Color theme preset */
  theme?: "dark" | "light";
  /** Show language tag in code blocks */
  showLanguage?: boolean;
}
