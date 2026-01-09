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
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const dataValue = el.getAttribute("data-value");
          // Fallback: use textContent if data-value is missing (e.g., after sanitization)
          if (dataValue !== null) {
            return { value: dataValue };
          }
          const text = el.textContent ?? "";
          return text ? { value: text } : false;
        },
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
