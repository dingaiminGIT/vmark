/**
 * Custom inline syntax remark plugin
 *
 * Parses ~subscript~, ^superscript^, ==highlight==, ++underline++ syntax.
 * Adds corresponding MDAST nodes and serializes them back to markdown.
 *
 * @module utils/markdownPipeline/plugins/customInline
 */

import type { Root, PhrasingContent, Text } from "mdast";
import type { Plugin } from "unified";
import type {
  Subscript,
  Superscript,
  Highlight,
  Underline,
} from "../types";

// Internal types for the from/to markdown extensions
// These are simplified versions since we only use a subset of the API
interface FromMarkdownExtension {
  transforms?: Array<(tree: Root) => void>;
}

interface ToMarkdownExtension {
  handlers?: Record<string, MarkHandler>;
  unsafe?: Array<{
    character: string;
    inConstruct?: string;
    notInConstruct?: string[];
    before?: string;
    after?: string;
  }>;
}

// Handler function type for serializing nodes
type MarkHandler = (
  node: unknown,
  parent: unknown,
  state: MarkHandlerState,
  info: { before: string; after: string }
) => string;

interface MarkHandlerState {
  createTracker: (info: { before: string; after: string }) => {
    move: (value: string) => string;
    current: () => { before: string; after: string };
  };
  enter: (constructName: string) => () => void;
  containerPhrasing: (
    node: { children: PhrasingContent[] },
    options: { before: string; after: string }
  ) => string;
}

// Mark definition type with optional skipDouble
interface MarkDefinition {
  readonly name: "highlight" | "underline" | "superscript" | "subscript";
  readonly marker: string;
  readonly markerLen: number;
  readonly skipDouble?: boolean;
}

// Syntax definitions
const MARKS: readonly MarkDefinition[] = [
  { name: "highlight", marker: "==", markerLen: 2 },
  { name: "underline", marker: "++", markerLen: 2 },
  { name: "superscript", marker: "^", markerLen: 1 },
  { name: "subscript", marker: "~", markerLen: 1, skipDouble: true },
];

type MarkName = "subscript" | "superscript" | "highlight" | "underline";

/**
 * Remark plugin to parse and serialize custom inline marks.
 */
export const remarkCustomInline: Plugin<[], Root> = function () {
  const data = this.data() as {
    fromMarkdownExtensions?: FromMarkdownExtension[];
    toMarkdownExtensions?: ToMarkdownExtension[];
  };

  data.fromMarkdownExtensions = data.fromMarkdownExtensions ?? [];
  data.toMarkdownExtensions = data.toMarkdownExtensions ?? [];

  data.fromMarkdownExtensions.push(customInlineFromMarkdown());
  data.toMarkdownExtensions.push(customInlineToMarkdown());
};

/**
 * Creates mdast-util-from-markdown extension for custom marks.
 * We handle this manually by walking the tree after initial parse.
 */
function customInlineFromMarkdown(): FromMarkdownExtension {
  return {
    // We use transforms instead of tokenizers
    transforms: [transformCustomMarks],
  };
}

/**
 * Transform function to find and parse custom mark syntax in text nodes.
 */
function transformCustomMarks(tree: Root): void {
  walkAndReplace(tree);
}

/**
 * Walk the tree and replace text nodes containing mark syntax.
 */
function walkAndReplace(node: Root | PhrasingContent | { children?: unknown[] }): void {
  if (!("children" in node) || !Array.isArray(node.children)) return;

  const newChildren: unknown[] = [];
  let modified = false;

  for (const child of node.children) {
    if (isTextNode(child)) {
      const replaced = parseMarksInText(child.value);
      if (replaced.length === 1 && isTextNode(replaced[0]) && replaced[0].value === child.value) {
        newChildren.push(child);
      } else {
        newChildren.push(...replaced);
        modified = true;
      }
    } else {
      walkAndReplace(child as { children?: unknown[] });
      newChildren.push(child);
    }
  }

  if (modified) {
    (node as { children: unknown[] }).children = newChildren;
  }
}

function isTextNode(node: unknown): node is Text {
  return typeof node === "object" && node !== null && (node as { type?: string }).type === "text";
}

/**
 * Parse custom marks from a text string.
 * Returns an array of text and mark nodes.
 * Finds the earliest mark in the text to ensure correct processing order.
 */
function parseMarksInText(text: string): PhrasingContent[] {
  const result: PhrasingContent[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Find the earliest mark (closest to start of remaining string)
    let earliestMark: typeof MARKS[number] | null = null;
    let earliestStart = -1;
    let earliestEnd = -1;

    for (const mark of MARKS) {
      let startIdx = 0;

      // Search for valid mark occurrence
      while (startIdx < remaining.length) {
        const foundStart = remaining.indexOf(mark.marker, startIdx);
        if (foundStart === -1) break;

        // Skip if this is a double marker when skipDouble is set
        if (mark.skipDouble && mark.markerLen === 1) {
          if (remaining[foundStart + 1] === mark.marker) {
            startIdx = foundStart + 2;
            continue;
          }
        }

        // Find closing marker
        let searchPos = foundStart + mark.markerLen;
        let endIdx = -1;

        while (searchPos < remaining.length) {
          const closeIdx = remaining.indexOf(mark.marker, searchPos);
          if (closeIdx === -1) break;

          // Skip double markers when configured
          if (mark.skipDouble && mark.markerLen === 1) {
            if (remaining[closeIdx + 1] === mark.marker) {
              searchPos = closeIdx + 2;
              continue;
            }
          }

          // Valid closing marker found
          endIdx = closeIdx;
          break;
        }

        if (endIdx === -1 || endIdx <= foundStart + mark.markerLen) {
          // No valid closing marker, try next occurrence
          startIdx = foundStart + 1;
          continue;
        }

        // Valid mark pair found
        if (earliestStart === -1 || foundStart < earliestStart) {
          earliestMark = mark;
          earliestStart = foundStart;
          earliestEnd = endIdx;
        }
        break;
      }
    }

    if (!earliestMark || earliestStart === -1) {
      // No more marks found, add remaining as text
      if (remaining.length > 0) {
        result.push({ type: "text", value: remaining });
      }
      break;
    }

    // Add text before the mark
    if (earliestStart > 0) {
      result.push({ type: "text", value: remaining.slice(0, earliestStart) });
    }

    // Add the mark node
    const content = remaining.slice(earliestStart + earliestMark.markerLen, earliestEnd);
    const markNode = createMarkNode(earliestMark.name as MarkName, content);
    result.push(markNode);

    // Continue with remaining text
    remaining = remaining.slice(earliestEnd + earliestMark.markerLen);
  }

  return result.length > 0 ? result : [{ type: "text", value: text }];
}

/**
 * Create a mark node with text children.
 */
function createMarkNode(name: MarkName, content: string): Subscript | Superscript | Highlight | Underline {
  const children: PhrasingContent[] = parseMarksInText(content);

  switch (name) {
    case "subscript":
      return { type: "subscript", children } as Subscript;
    case "superscript":
      return { type: "superscript", children } as Superscript;
    case "highlight":
      return { type: "highlight", children } as Highlight;
    case "underline":
      return { type: "underline", children } as Underline;
  }
}

/**
 * Creates mdast-util-to-markdown extension for custom marks.
 */
function customInlineToMarkdown(): ToMarkdownExtension {
  return {
    handlers: {
      subscript: createMarkHandler("~", "subscript"),
      superscript: createMarkHandler("^", "superscript"),
      highlight: createMarkHandler("==", "highlight"),
      underline: createMarkHandler("++", "underline"),
    },
    unsafe: [
      // Override GFM's ~ escaping to exclude our subscript construct
      // This needs to match but be more permissive than the GFM rule
      {
        character: "~",
        inConstruct: "phrasing",
        notInConstruct: [
          "autolink",
          "destinationLiteral",
          "destinationRaw",
          "reference",
          "titleQuote",
          "titleApostrophe",
          "subscript", // Add our construct
        ],
      },
      // Escape marker sequences to prevent false parsing
      { character: "=", inConstruct: "phrasing", before: "[^=]", after: "=", notInConstruct: ["highlight"] },
      { character: "+", inConstruct: "phrasing", before: "[^+]", after: "\\+", notInConstruct: ["underline"] },
    ],
  };
}

/**
 * Create a handler for serializing a mark type.
 * Uses state.enter() to register construct for unsafe rule exclusion.
 */
function createMarkHandler(marker: string, constructName: string): MarkHandler {
  return function (node: unknown, _parent: unknown, state: MarkHandlerState, info: { before: string; after: string }) {
    const tracker = state.createTracker(info);
    const exit = state.enter(constructName);

    let value = tracker.move(marker);
    const current = tracker.current();
    value += state.containerPhrasing(node as { children: PhrasingContent[] }, {
      ...current,
      before: marker,
      after: marker,
    });
    value += tracker.move(marker);

    exit();
    return value;
  };
}
