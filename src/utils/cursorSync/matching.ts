import type { CursorContext, WordPosition } from "./types";
import {
  getLineFromContentIndex,
  stripInlineFormatting,
  isContentLine,
} from "./markdown";

const CONTEXT_LENGTH = 10; // Characters of context to store

/**
 * Extract word and context at cursor position
 */
export function extractCursorContext(
  text: string,
  pos: number
): CursorContext {
  if (!text || pos < 0) {
    return { word: "", offsetInWord: 0, contextBefore: "", contextAfter: "" };
  }

  // Clamp position
  pos = Math.min(pos, text.length);

  // Find word boundaries
  let start = pos;
  let end = pos;

  // Move start back to word boundary
  while (start > 0 && /\w/.test(text[start - 1])) {
    start--;
  }

  // Move end forward to word boundary
  while (end < text.length && /\w/.test(text[end])) {
    end++;
  }

  const word = text.slice(start, end);
  const offsetInWord = pos - start;

  // Extract context (characters around cursor, not just word)
  const contextStart = Math.max(0, pos - CONTEXT_LENGTH);
  const contextEnd = Math.min(text.length, pos + CONTEXT_LENGTH);
  const contextBefore = text.slice(contextStart, pos);
  const contextAfter = text.slice(pos, contextEnd);

  return { word, offsetInWord, contextBefore, contextAfter };
}

/**
 * Find best matching position for cursor in target lines
 * Uses multiple strategies for accurate positioning
 */
export function findBestPosition(
  lines: string[],
  contentLineIndex: number,
  context: CursorContext,
  percentInLine: number
): WordPosition {
  const targetLine = getLineFromContentIndex(lines, contentLineIndex);
  const lineText = lines[targetLine] || "";

  // Strategy 1: Exact context match
  if (context.contextBefore || context.contextAfter) {
    const contextMatch = findContextMatch(lines, targetLine, context);
    if (contextMatch) {
      return contextMatch;
    }
  }

  // Strategy 2: Word match in target line
  if (context.word) {
    const wordMatch = findWordInLine(lineText, context.word, context.offsetInWord);
    if (wordMatch !== -1) {
      return { line: targetLine, column: wordMatch };
    }

    // Try nearby lines
    for (let offset = 1; offset <= 2; offset++) {
      for (const delta of [-offset, offset]) {
        const searchLine = targetLine + delta;
        if (searchLine >= 0 && searchLine < lines.length && isContentLine(lines[searchLine])) {
          const match = findWordInLine(
            lines[searchLine],
            context.word,
            context.offsetInWord
          );
          if (match !== -1) {
            return { line: searchLine, column: match };
          }
        }
      }
    }
  }

  // Strategy 3: Percentage-based fallback
  const column = Math.round(percentInLine * lineText.length);
  return { line: targetLine, column: Math.min(column, lineText.length) };
}

/**
 * Find word in line, handling inline formatting differences
 */
function findWordInLine(
  lineText: string,
  word: string,
  offsetInWord: number
): number {
  if (!word) return -1;

  // Try exact match first
  let idx = lineText.indexOf(word);
  if (idx !== -1) {
    return idx + offsetInWord;
  }

  // Try with stripped formatting
  const strippedLine = stripInlineFormatting(lineText);
  idx = strippedLine.indexOf(word);
  if (idx !== -1) {
    // Map position back to original line
    return mapStrippedToOriginal(lineText, strippedLine, idx + offsetInWord);
  }

  return -1;
}

/**
 * Find position by context matching
 */
function findContextMatch(
  lines: string[],
  targetLine: number,
  context: CursorContext
): WordPosition | null {
  // Search target line and nearby lines
  for (let offset = 0; offset <= 2; offset++) {
    for (const delta of offset === 0 ? [0] : [-offset, offset]) {
      const searchLine = targetLine + delta;
      if (searchLine < 0 || searchLine >= lines.length) continue;

      const lineText = lines[searchLine];
      const strippedLine = stripInlineFormatting(lineText);

      // Look for context pattern
      const pattern = context.contextBefore + context.contextAfter;
      if (pattern.length >= 3) {
        const idx = strippedLine.indexOf(pattern);
        if (idx !== -1) {
          const column = mapStrippedToOriginal(
            lineText,
            strippedLine,
            idx + context.contextBefore.length
          );
          return { line: searchLine, column };
        }
      }
    }
  }

  return null;
}

/**
 * Map position from stripped text back to original text
 */
function mapStrippedToOriginal(
  original: string,
  stripped: string,
  strippedPos: number
): number {
  // Simple approach: find the character at stripped position and locate it in original
  if (strippedPos >= stripped.length) {
    return original.length;
  }

  // Count non-formatting characters up to strippedPos
  let strippedCount = 0;
  let originalPos = 0;

  // Track formatting markers
  const formatPatterns = [
    /^\*\*/, /^__/, // Bold start
    /^\*(?!\*)/, /^_(?!_)/, // Italic start (not bold)
    /^~~/, // Strikethrough
    /^`(?!`)/, // Inline code
    /^\[([^\]]*)\]\([^)]*\)/, // Links
  ];

  while (originalPos < original.length && strippedCount < strippedPos) {
    let matched = false;

    // Check for formatting markers to skip
    for (const pattern of formatPatterns) {
      const match = original.slice(originalPos).match(pattern);
      if (match) {
        // For links, we need special handling
        if (pattern.source.includes("\\[")) {
          // Skip the markdown syntax, count the text content
          const linkMatch = original.slice(originalPos).match(/^\[([^\]]*)\]\([^)]*\)/);
          if (linkMatch) {
            const textContent = linkMatch[1];
            const remaining = strippedPos - strippedCount;
            if (remaining <= textContent.length) {
              return originalPos + 1 + remaining; // +1 for [
            }
            strippedCount += textContent.length;
            originalPos += linkMatch[0].length;
            matched = true;
            break;
          }
        }
      }
    }

    if (!matched) {
      // Regular character
      strippedCount++;
      originalPos++;
    }
  }

  return originalPos;
}
