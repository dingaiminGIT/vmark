import Image from "@tiptap/extension-image";
import type { NodeView } from "@tiptap/pm/view";
import { ImageNodeView } from "./index";

export const imageViewExtension = Image.extend({
  addNodeView() {
    return ({ node, getPos, editor }) => {
      return new ImageNodeView(
        node as unknown as ConstructorParameters<typeof ImageNodeView>[0],
        getPos as unknown as ConstructorParameters<typeof ImageNodeView>[1],
        editor
      ) as unknown as NodeView;
    };
  },
}).configure({ inline: true });
