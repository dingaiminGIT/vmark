import "./block-image.css";
import { Node } from "@tiptap/core";
import type { NodeView } from "@tiptap/pm/view";
import { BlockImageNodeView } from "./BlockImageNodeView";

export const blockImageExtension = Node.create({
  name: "block_image",
  group: "block",
  atom: true,
  isolating: true,
  selectable: true,
  draggable: true,
  marks: "",
  defining: true,

  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      title: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-type="block_image"]',
        getAttrs: (dom) => {
          const img = (dom as HTMLElement).querySelector("img");
          return {
            src: img?.getAttribute("src") ?? "",
            alt: img?.getAttribute("alt") ?? "",
            title: img?.getAttribute("title") ?? "",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "figure",
      {
        ...HTMLAttributes,
        "data-type": "block_image",
        class: "block-image",
      },
      [
        "img",
        {
          src: String(node.attrs.src ?? ""),
          alt: String(node.attrs.alt ?? ""),
          title: String(node.attrs.title ?? ""),
        },
      ],
    ];
  },

  addNodeView() {
    return ({ node, getPos }) => {
      const safeGetPos = typeof getPos === "function" ? getPos : () => undefined;
      return new BlockImageNodeView(node, safeGetPos) as unknown as NodeView;
    };
  },
});
