/**
 * Inline LaTeX Schema
 *
 * Defines a ProseMirror node for inline math expressions.
 * Renders using KaTeX. Stores content as text within the node.
 */

import { $nodeSchema } from "@milkdown/kit/utils";

export const mathInlineId = "math_inline";

/**
 * Schema for inline math node.
 * Supports syntax: $a^2 + b^2 = c^2$
 * Stores LaTeX content as text content within the node.
 */
export const mathInlineSchema = $nodeSchema(mathInlineId, () => ({
  group: "inline",
  inline: true,
  content: "text*",
  marks: "",
  atom: false,
  code: true,
  parseDOM: [
    {
      tag: `span[data-type="${mathInlineId}"]`,
      preserveWhitespace: "full" as const,
      getAttrs: () => ({}),
    },
  ],
  toDOM: () => {
    return [
      "span",
      {
        "data-type": mathInlineId,
        class: "math-inline",
      },
      0,
    ] as const;
  },
  parseMarkdown: {
    match: (node) => node.type === "inlineMath",
    runner: (state, node, type) => {
      const value = (node.value as string) || "";
      state.openNode(type);
      if (value) {
        state.addText(value);
      }
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === mathInlineId,
    runner: (state, node) => {
      state.addNode("inlineMath", undefined, node.textContent || "");
    },
  },
}));
