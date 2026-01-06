import { mergeAttributes, Node } from "@tiptap/core";

export const footnoteReferenceExtension = Node.create({
  name: "footnote_reference",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      label: {
        default: "1",
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-label") ?? "1",
        renderHTML: (attributes) => ({ "data-label": String(attributes.label ?? "") }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'sup[data-type="footnote_reference"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = String(node.attrs.label ?? "");
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        "data-type": "footnote_reference",
        "data-label": label,
        contenteditable: "false",
      }),
      label,
    ];
  },
});

export const footnoteDefinitionExtension = Node.create({
  name: "footnote_definition",
  group: "block",
  content: "paragraph",
  defining: true,

  addAttributes() {
    return {
      label: {
        default: "1",
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-label") ?? "1",
        renderHTML: (attributes) => ({ "data-label": String(attributes.label ?? "") }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'dl[data-type="footnote_definition"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = String(node.attrs.label ?? "");
    return [
      "dl",
      mergeAttributes(HTMLAttributes, {
        "data-type": "footnote_definition",
        "data-label": label,
      }),
      ["dt", { "data-label": label, contenteditable: "false" }, label],
      ["dd", { "data-label": label }, 0],
    ];
  },
});

