import { Node, mergeAttributes } from "@tiptap/core";

export const frontmatterExtension = Node.create({
  name: "frontmatter",
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
        tag: 'div[data-type="frontmatter"]',
        getAttrs: (element) => ({
          value: (element as HTMLElement).getAttribute("data-value") ?? "",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "frontmatter",
        "data-value": String(node.attrs.value ?? ""),
        contenteditable: "false",
      }),
    ];
  },
});
