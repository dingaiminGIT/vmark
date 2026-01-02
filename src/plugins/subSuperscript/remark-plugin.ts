/**
 * Remark Plugin for Subscript/Superscript
 *
 * Parses ~subscript~ and ^superscript^ syntax in markdown.
 * Also handles HTML <sub> and <sup> tags.
 */

import { $remark } from "@milkdown/kit/utils";
import { findAndReplace, type Find, type Replace } from "mdast-util-find-and-replace";
import { visit } from "unist-util-visit";
import type { Root, Parent, PhrasingContent } from "mdast";

// Regex patterns for markdown syntax
// Subscript: ~text~ (but not ~~strikethrough~~)
const SUB_REGEX = /(?<![~\\])~([^~\s][^~]*[^~\s]|[^~\s])~(?!~)/g;
// Superscript: ^text^ (but not escaped)
const SUP_REGEX = /(?<![\\])\^([^^]+)\^/g;

/**
 * Custom mdast node types for subscript/superscript
 */
interface SubscriptNode {
  type: "subscript";
  data: { hName: "sub" };
  children: Array<{ type: "text"; value: string }>;
}

interface SuperscriptNode {
  type: "superscript";
  data: { hName: "sup" };
  children: Array<{ type: "text"; value: string }>;
}

/**
 * Creates a subscript node from matched text
 */
function createSubscriptNode(_: string, text: string): SubscriptNode {
  return {
    type: "subscript",
    data: { hName: "sub" },
    children: [{ type: "text", value: text }],
  };
}

/**
 * Creates a superscript node from matched text
 */
function createSuperscriptNode(_: string, text: string): SuperscriptNode {
  return {
    type: "superscript",
    data: { hName: "sup" },
    children: [{ type: "text", value: text }],
  };
}

/**
 * Check if a node is an HTML node with specific tag
 */
function isHtmlTag(node: PhrasingContent | undefined, tag: string): boolean {
  if (!node || node.type !== "html") return false;
  const value = (node as { value: string }).value.toLowerCase().trim();
  return value === tag;
}

/**
 * Check if a node is a text node and get its value
 */
function getTextValue(node: PhrasingContent | undefined): string | null {
  if (!node || node.type !== "text") return null;
  return (node as { value: string }).value;
}

/**
 * Process inline HTML tags like <sup>text</sup> and <sub>text</sub>
 * These appear as separate sibling nodes: html("<sup>") + text + html("</sup>")
 */
function processInlineHtmlTags(tree: Root) {
  visit(tree, "paragraph", (node: Parent) => {
    const children = node.children as PhrasingContent[];
    const newChildren: PhrasingContent[] = [];
    let i = 0;

    while (i < children.length) {
      const current = children[i];
      const next = children[i + 1];
      const afterNext = children[i + 2];

      // Check for <sup>text</sup> pattern
      if (isHtmlTag(current, "<sup>") && next && isHtmlTag(afterNext, "</sup>")) {
        const text = getTextValue(next);
        if (text !== null) {
          newChildren.push(createSuperscriptNode("", text) as unknown as PhrasingContent);
          i += 3;
          continue;
        }
      }

      // Check for <sub>text</sub> pattern
      if (isHtmlTag(current, "<sub>") && next && isHtmlTag(afterNext, "</sub>")) {
        const text = getTextValue(next);
        if (text !== null) {
          newChildren.push(createSubscriptNode("", text) as unknown as PhrasingContent);
          i += 3;
          continue;
        }
      }

      // Keep the node as-is
      newChildren.push(current);
      i++;
    }

    // Replace children if we made changes
    if (newChildren.length !== children.length) {
      node.children = newChildren;
    }
  });
}

/**
 * Remark plugin that transforms ~text~ to subscript and ^text^ to superscript
 * Also handles HTML <sub> and <sup> tags
 */
function remarkSubSuperscript() {
  return (tree: Root) => {
    // Handle markdown syntax (~text~, ^text^) via text replacement
    findAndReplace(tree, [
      [SUB_REGEX as unknown as Find, createSubscriptNode as unknown as Replace],
      [SUP_REGEX as unknown as Find, createSuperscriptNode as unknown as Replace],
    ]);

    // Handle HTML tags (<sub>, <sup>) by finding sibling patterns
    processInlineHtmlTags(tree);
  };
}

/**
 * Milkdown remark plugin wrapper
 */
export const remarkSubSuperscriptPlugin = $remark(
  "remarkSubSuperscript",
  () => remarkSubSuperscript
);
