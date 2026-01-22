/**
 * Tab Escape Link Navigation for CodeMirror
 *
 * Handles Tab key navigation within markdown links:
 * - From [text] to (url) - Tab jumps to URL portion
 * - From (url) to outside - Tab jumps after closing paren
 */

import { EditorView } from "@codemirror/view";

export interface LinkBoundaries {
  /** Position after [ */
  textStart: number;
  /** Position before ] */
  textEnd: number;
  /** Position after ( */
  urlStart: number;
  /** Position before ) */
  urlEnd: number;
  /** Position after ) */
  linkEnd: number;
}

/**
 * Find the boundaries of a markdown link at or around the given position.
 * Searches both backwards and forwards to find the enclosing link.
 *
 * @param text - The line text to search in
 * @param posInLine - Cursor position within the line (0-indexed)
 * @returns Link boundaries or null if not in a link
 */
export function getLinkBoundaries(
  text: string,
  posInLine: number
): LinkBoundaries | null {
  // Find potential link patterns in the text
  // Link format: [text](url) or [text](url "title")
  const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;

  let match;
  while ((match = linkRegex.exec(text)) !== null) {
    const linkStart = match.index;
    const linkEnd = match.index + match[0].length;

    // Check if cursor is within this link
    if (posInLine >= linkStart && posInLine <= linkEnd) {
      const bracketEnd = linkStart + 1 + match[1].length; // Position of ]
      const parenStart = bracketEnd + 2; // Position after (

      return {
        textStart: linkStart + 1, // After [
        textEnd: bracketEnd, // Before ]
        urlStart: parenStart, // After (
        urlEnd: linkEnd - 1, // Before )
        linkEnd: linkEnd, // After )
      };
    }
  }

  return null;
}

/**
 * Check if cursor position is inside the link text portion [text].
 */
export function isInLinkText(
  boundaries: LinkBoundaries,
  posInLine: number
): boolean {
  return posInLine >= boundaries.textStart && posInLine <= boundaries.textEnd;
}

/**
 * Check if cursor position is inside the link URL portion (url).
 */
export function isInLinkUrl(
  boundaries: LinkBoundaries,
  posInLine: number
): boolean {
  return posInLine >= boundaries.urlStart && posInLine <= boundaries.urlEnd;
}

/**
 * Handle Tab key to navigate within markdown links.
 *
 * - When cursor is in [text]: Tab jumps to (url)
 * - When cursor is in (url): Tab jumps after the link
 *
 * @returns true if handled, false to fall through to default Tab behavior
 */
export function tabNavigateLink(view: EditorView): boolean {
  const { state } = view;
  const { from, to } = state.selection.main;

  // Only handle cursor, not selection
  if (from !== to) return false;

  // Get the current line
  const line = state.doc.lineAt(from);
  const posInLine = from - line.from;
  const lineText = line.text;

  // Check if cursor is in a link
  const boundaries = getLinkBoundaries(lineText, posInLine);
  if (!boundaries) return false;

  // Determine where to jump
  let targetPosInLine: number;

  if (isInLinkText(boundaries, posInLine)) {
    // In text portion: jump to URL start
    targetPosInLine = boundaries.urlStart;
  } else if (isInLinkUrl(boundaries, posInLine)) {
    // In URL portion: jump after the link
    targetPosInLine = boundaries.linkEnd;
  } else {
    // Between ] and ( or outside - shouldn't happen but handle gracefully
    return false;
  }

  // Calculate absolute position and move cursor
  const targetPos = line.from + targetPosInLine;

  view.dispatch({
    selection: { anchor: targetPos },
    scrollIntoView: true,
  });

  return true;
}
