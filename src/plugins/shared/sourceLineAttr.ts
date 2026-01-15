/**
 * Shared sourceLine attribute definition.
 *
 * Used for cursor sync between Source and WYSIWYG modes.
 * The sourceLine is set during MDAST → ProseMirror conversion
 * and represents the original line number in the markdown source.
 */
export const sourceLineAttr = {
  sourceLine: {
    default: null as number | null,
    // No parseHTML - sourceLine is only set programmatically during MDAST conversion
    // No renderHTML - sourceLine is internal, not rendered to DOM
  },
} as const;

/**
 * Interface for extensions that can be extended with additional attributes.
 */
interface ExtendableExtension {
  extend: (config: { addAttributes: () => Record<string, unknown> }) => ExtendableExtension;
}

/**
 * Extend a Tiptap node/mark/extension with sourceLine attribute.
 * Reduces boilerplate when adding cursor sync support to nodes.
 *
 * @example
 * const HeadingWithSourceLine = withSourceLine(Heading);
 *
 * @param extension - The Tiptap extension to extend
 * @returns Extended extension with sourceLine attribute
 */
export function withSourceLine<T extends ExtendableExtension>(extension: T): T {
  return extension.extend({
    addAttributes() {
      return {
        ...(this as unknown as { parent?: () => Record<string, unknown> }).parent?.(),
        ...sourceLineAttr,
      };
    },
  }) as T;
}
