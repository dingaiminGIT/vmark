import { Node, mergeAttributes } from "@tiptap/core";
import { sourceLineAttr } from "../shared/sourceLineAttr";

/**
 * Wiki Link Node
 *
 * Inline node for wiki-style links [[target]] or [[target|alias]].
 * - `value` attribute: the target page/file path
 * - Text content: the display text (alias), editable inline
 *
 * Unlike atom nodes, users can edit the display text directly in the editor.
 * The target is edited via the popup.
 */
export const wikiLinkExtension = Node.create({
  name: "wikiLink",
  inline: true,
  group: "inline",
  content: "text*",
  selectable: true,

  addAttributes() {
    return {
      ...sourceLineAttr,
      value: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="wiki-link"]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const dataValue = el.getAttribute("data-value");
          if (dataValue) {
            return { value: dataValue };
          }
          // Fallback: use textContent as value if data-value missing
          const text = el.textContent?.trim() ?? "";
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
        "data-type": "wiki-link",
        "data-value": value,
        class: "wiki-link",
      }),
      0, // Content hole - text content goes here
    ];
  },
});
