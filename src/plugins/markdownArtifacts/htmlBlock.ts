import { Node, mergeAttributes } from "@tiptap/core";
import type { NodeView } from "@tiptap/pm/view";
import { createHtmlBlockNodeView } from "./HtmlNodeView";

export const htmlBlockExtension = Node.create({
  name: "html_block",
  group: "block",
  atom: true,
  selectable: false,
  isolating: true,

  addAttributes() {
    return {
      value: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="html-block"]',
        getAttrs: (element) => ({
          value: (element as HTMLElement).getAttribute("data-value") ?? "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const value = String(node.attrs.value ?? "");
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "html-block",
        "data-value": value,
        contenteditable: "false",
      }),
      value,
    ];
  },

  addNodeView() {
    return ({ node }) => createHtmlBlockNodeView(node) as NodeView;
  },
});
