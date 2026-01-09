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
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const dataValue = el.getAttribute("data-value");
          // Fallback: use textContent if data-value is missing (e.g., after sanitization)
          // Return false to skip parsing if no value can be recovered
          if (dataValue !== null) {
            return { value: dataValue };
          }
          const text = el.textContent?.trim() ?? "";
          return text ? { value: text } : false;
        },
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
