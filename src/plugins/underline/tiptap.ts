import { Mark, mergeAttributes } from "@tiptap/core";

export const underlineExtension = Mark.create({
  name: "underline",
  parseHTML() {
    return [{ tag: "u" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["u", mergeAttributes(HTMLAttributes, { class: "md-underline" }), 0];
  },
});
