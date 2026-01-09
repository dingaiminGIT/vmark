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
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const dataValue = el.getAttribute("data-value");
          // Fallback: parse from textContent if data-value is missing (e.g., after sanitization)
          if (dataValue) {
            return { value: dataValue, alias: el.getAttribute("data-alias") };
          }
          // textContent should be the display label (alias or value)
          const text = el.textContent?.trim() ?? "";
          return text ? { value: text, alias: null } : false;
        },
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
