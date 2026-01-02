/**
 * Subscript and Superscript Mark Schemas
 *
 * Defines ProseMirror marks for ~subscript~ and ^superscript^ syntax.
 */

import { $markSchema } from "@milkdown/kit/utils";

/**
 * Subscript mark schema
 * Syntax: ~text~ renders as <sub>text</sub>
 */
export const subscriptSchema = $markSchema("subscript", () => ({
  parseDOM: [{ tag: "sub" }],
  toDOM: () => ["sub", { class: "md-subscript" }, 0] as const,
  parseMarkdown: {
    match: (node) => node.type === "subscript",
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "subscript",
    runner: (state, mark) => {
      state.withMark(mark, "subscript");
    },
  },
}));

/**
 * Superscript mark schema
 * Syntax: ^text^ renders as <sup>text</sup>
 */
export const superscriptSchema = $markSchema("superscript", () => ({
  parseDOM: [{ tag: "sup" }],
  toDOM: () => ["sup", { class: "md-superscript" }, 0] as const,
  parseMarkdown: {
    match: (node) => node.type === "superscript",
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next(node.children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === "superscript",
    runner: (state, mark) => {
      state.withMark(mark, "superscript");
    },
  },
}));
