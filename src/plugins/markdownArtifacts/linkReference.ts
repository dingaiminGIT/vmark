import { Node, mergeAttributes } from "@tiptap/core";

export const linkReferenceExtension = Node.create({
  name: "link_reference",
  inline: true,
  group: "inline",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      identifier: { default: "" },
      label: { default: null },
      referenceType: { default: "full" },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="link-reference"]',
        getAttrs: (element) => ({
          identifier: (element as HTMLElement).getAttribute("data-identifier") ?? "",
          label: (element as HTMLElement).getAttribute("data-label"),
          referenceType: (element as HTMLElement).getAttribute("data-reference-type") ?? "full",
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "link-reference",
        "data-identifier": String(node.attrs.identifier ?? ""),
        "data-label": node.attrs.label ?? null,
        "data-reference-type": String(node.attrs.referenceType ?? "full"),
      }),
      0,
    ];
  },
});
