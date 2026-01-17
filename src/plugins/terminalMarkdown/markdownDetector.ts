/**
 * Markdown Detector
 *
 * Stream-aware markdown block detection for terminal output.
 * Buffers incomplete blocks for streaming scenarios.
 */

import type { MarkdownBlock, DetectionResult } from "./types";

// Code fence patterns
const CODE_FENCE_START = /^```(\w*)$/m;
const CODE_FENCE_END = /^```$/m;

// Heading patterns (# style)
const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/m;

// List patterns
const BULLET_LIST_PATTERN = /^[\s]*[-*]\s+(.+)$/m;
const ORDERED_LIST_PATTERN = /^[\s]*(\d+)\.\s+(.+)$/m;

// Blockquote pattern
const BLOCKQUOTE_PATTERN = /^>\s+(.*)$/m;

// Horizontal rule pattern
const HR_PATTERN = /^(-{3,}|_{3,}|\*{3,})$/m;

/**
 * Markdown Detector class with stateful buffering
 */
export class MarkdownDetector {
  private buffer: string = "";
  private inCodeBlock: boolean = false;
  private codeBlockLanguage: string = "";
  private codeBlockContent: string[] = [];

  /**
   * Process incoming text chunk
   * @param chunk - New text chunk from terminal
   * @returns Detection result with blocks and remaining incomplete text
   */
  process(chunk: string): DetectionResult {
    // Combine buffer with new chunk
    const text = this.buffer + chunk;
    const lines = text.split("\n");
    const blocks: MarkdownBlock[] = [];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const isLastLine = i === lines.length - 1;

      // Handle code block state
      if (this.inCodeBlock) {
        if (CODE_FENCE_END.test(line)) {
          // End of code block
          blocks.push({
            type: "codeBlock",
            content: this.codeBlockContent.join("\n"),
            language: this.codeBlockLanguage || undefined,
            raw: "```" + this.codeBlockLanguage + "\n" + this.codeBlockContent.join("\n") + "\n```",
          });
          this.inCodeBlock = false;
          this.codeBlockLanguage = "";
          this.codeBlockContent = [];
        } else {
          // Inside code block, accumulate content
          this.codeBlockContent.push(line);
        }
        i++;
        continue;
      }

      // Check for code fence start
      const fenceMatch = line.match(CODE_FENCE_START);
      if (fenceMatch) {
        this.inCodeBlock = true;
        this.codeBlockLanguage = fenceMatch[1] || "";
        this.codeBlockContent = [];
        i++;
        continue;
      }

      // Don't process last incomplete line (might be partial)
      if (isLastLine && !text.endsWith("\n")) {
        break;
      }

      // Check for heading
      const headingMatch = line.match(HEADING_PATTERN);
      if (headingMatch) {
        blocks.push({
          type: "heading",
          level: headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6,
          content: headingMatch[2],
          raw: line,
        });
        i++;
        continue;
      }

      // Check for blockquote
      const quoteMatch = line.match(BLOCKQUOTE_PATTERN);
      if (quoteMatch) {
        blocks.push({
          type: "blockquote",
          content: quoteMatch[1],
          raw: line,
        });
        i++;
        continue;
      }

      // Check for horizontal rule
      if (HR_PATTERN.test(line)) {
        blocks.push({
          type: "horizontalRule",
          content: "",
          raw: line,
        });
        i++;
        continue;
      }

      // Check for bullet list
      const bulletMatch = line.match(BULLET_LIST_PATTERN);
      if (bulletMatch) {
        blocks.push({
          type: "list",
          listType: "bullet",
          content: bulletMatch[1],
          raw: line,
        });
        i++;
        continue;
      }

      // Check for ordered list
      const orderedMatch = line.match(ORDERED_LIST_PATTERN);
      if (orderedMatch) {
        blocks.push({
          type: "list",
          listType: "ordered",
          content: orderedMatch[2],
          raw: line,
        });
        i++;
        continue;
      }

      // Default: treat as plain paragraph
      if (line.trim()) {
        blocks.push({
          type: "paragraph",
          content: line,
          raw: line,
        });
      }
      i++;
    }

    // Calculate remaining buffer
    let incomplete = "";
    if (this.inCodeBlock) {
      // If in code block, buffer everything from start of code block
      incomplete = "```" + this.codeBlockLanguage + "\n" + this.codeBlockContent.join("\n");
    } else if (i < lines.length) {
      // Last line was incomplete
      incomplete = lines.slice(i).join("\n");
    }

    this.buffer = incomplete;

    return { blocks, incomplete };
  }

  /**
   * Reset detector state (e.g., on new PTY session)
   */
  reset(): void {
    this.buffer = "";
    this.inCodeBlock = false;
    this.codeBlockLanguage = "";
    this.codeBlockContent = [];
  }

  /**
   * Flush any remaining buffered content as blocks
   */
  flush(): MarkdownBlock[] {
    const blocks: MarkdownBlock[] = [];

    // Flush incomplete code block if any
    if (this.inCodeBlock) {
      blocks.push({
        type: "codeBlock",
        content: this.codeBlockContent.join("\n"),
        language: this.codeBlockLanguage || undefined,
        raw: "```" + this.codeBlockLanguage + "\n" + this.codeBlockContent.join("\n"),
      });
    } else if (this.buffer.trim()) {
      // Flush remaining buffer as paragraph
      blocks.push({
        type: "paragraph",
        content: this.buffer,
        raw: this.buffer,
      });
    }

    this.reset();
    return blocks;
  }
}

/**
 * Create a new markdown detector instance
 */
export function createMarkdownDetector(): MarkdownDetector {
  return new MarkdownDetector();
}
