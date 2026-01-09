import { Node, mergeAttributes } from "@tiptap/core";
import type { NodeView } from "@tiptap/pm/view";
import { createHtmlInlineNodeView } from "./HtmlNodeView";

export const htmlInlineExtension = Node.create({
  name: "html_inline",
  inline: true,
  group: "inline",
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      value: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="html"]',
        getAttrs: (element) => ({
          value: (element as HTMLElement).getAttribute("data-value") ?? "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const value = String(node.attrs.value ?? "");
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "html",
        "data-value": value,
        contenteditable: "false",
      }),
      value,
    ];
  },

  addNodeView() {
    return ({ node }) => createHtmlInlineNodeView(node) as NodeView;
  },
});
