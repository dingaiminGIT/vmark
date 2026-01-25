/**
 * Resolve link and image references plugin
 *
 * Converts linkReference and imageReference nodes to their resolved forms
 * (link and image) using the definition table. Definition nodes are preserved
 * for serialization back to markdown.
 *
 * Example:
 *   Input:  [text][id] ... [id]: https://example.com "Title"
 *   Output: [text](https://example.com "Title") (as link node)
 *           Definition node preserved separately
 *
 * @module utils/markdownPipeline/plugins/resolveReferences
 */

import type { Root, Definition, LinkReference, ImageReference, Link, Image, Content } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

interface DefinitionInfo {
  url: string;
  title: string | null;
}

/**
 * Remark plugin to resolve link and image references.
 *
 * This runs after parsing to convert reference-style links/images to their
 * resolved inline forms while preserving definition nodes.
 */
export const remarkResolveReferences: Plugin<[], Root> = function () {
  return (tree) => {
    // First pass: collect definitions
    const definitions = new Map<string, DefinitionInfo>();

    visit(tree, "definition", (node: Definition) => {
      const id = node.identifier.toLowerCase();
      definitions.set(id, {
        url: node.url,
        title: node.title ?? null,
      });
    });

    // Second pass: resolve references
    visit(tree, (node, index, parent) => {
      if (!parent || index === undefined) return;

      if (node.type === "linkReference") {
        const resolved = resolveLinkReference(node as LinkReference, definitions);
        if (resolved) {
          (parent.children as Content[])[index] = resolved;
        }
      } else if (node.type === "imageReference") {
        const resolved = resolveImageReference(node as ImageReference, definitions);
        if (resolved) {
          (parent.children as Content[])[index] = resolved;
        }
      }
    });
  };
};

/**
 * Resolve a linkReference to a link node.
 * Returns null if the definition is not found (node will be kept as-is).
 */
function resolveLinkReference(
  node: LinkReference,
  definitions: Map<string, DefinitionInfo>
): Link | null {
  const id = (node.identifier || node.label || "").toLowerCase();
  const def = definitions.get(id);

  if (!def) {
    // Definition not found - in dev mode this will show a warning
    // when the linkReference falls through to default case in converter
    return null;
  }

  return {
    type: "link",
    url: def.url,
    title: def.title,
    children: node.children,
    position: node.position,
  };
}

/**
 * Resolve an imageReference to an image node.
 * Returns null if the definition is not found.
 */
function resolveImageReference(
  node: ImageReference,
  definitions: Map<string, DefinitionInfo>
): Image | null {
  const id = (node.identifier || node.label || "").toLowerCase();
  const def = definitions.get(id);

  if (!def) {
    return null;
  }

  return {
    type: "image",
    url: def.url,
    title: def.title,
    alt: node.alt ?? null,
    position: node.position,
  };
}
