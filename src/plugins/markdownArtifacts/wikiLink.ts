import { Node, mergeAttributes } from "@tiptap/core";

export const wikiLinkExtension = Node.create({
  name: "wikiLink",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      value: { default: "" },
      alias: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="wiki-link"]',
        getAttrs: (element) => ({
          value: (element as HTMLElement).getAttribute("data-value") ?? "",
          alias: (element as HTMLElement).getAttribute("data-alias"),
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const value = String(node.attrs.value ?? "");
    const alias = node.attrs.alias ? String(node.attrs.alias) : "";
    const label = alias || value;

    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "wiki-link",
        "data-value": value,
        "data-alias": alias || null,
        class: "wiki-link",
      }),
      label,
    ];
  },
});
