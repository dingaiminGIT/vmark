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
