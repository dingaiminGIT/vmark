import { Node, mergeAttributes } from "@tiptap/core";

export const linkDefinitionExtension = Node.create({
  name: "link_definition",
  group: "block",
  atom: true,
  selectable: false,
  isolating: true,

  addAttributes() {
    return {
      identifier: { default: "" },
      label: { default: null },
      url: { default: "" },
      title: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="link-definition"]',
        getAttrs: (element) => ({
          identifier: (element as HTMLElement).getAttribute("data-identifier") ?? "",
          label: (element as HTMLElement).getAttribute("data-label"),
          url: (element as HTMLElement).getAttribute("data-url") ?? "",
          title: (element as HTMLElement).getAttribute("data-title"),
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "link-definition",
        "data-identifier": String(node.attrs.identifier ?? ""),
        "data-label": node.attrs.label ?? null,
        "data-url": String(node.attrs.url ?? ""),
        "data-title": node.attrs.title ?? null,
        contenteditable: "false",
      }),
    ];
  },
});
