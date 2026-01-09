import { Node, mergeAttributes } from "@tiptap/core";

export const wikiEmbedExtension = Node.create({
  name: "wikiEmbed",
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
        tag: 'span[data-type="wiki-embed"]',
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
    const label = alias ? `${value}|${alias}` : value;

    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "wiki-embed",
        "data-value": value,
        "data-alias": alias || null,
        class: "wiki-embed",
        contenteditable: "false",
      }),
      `![[${label}]]`,
    ];
  },
});
