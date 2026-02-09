/**
 * SVG Block Renderer
 *
 * Validates that a code block's content is well-formed SVG.
 * Unlike mermaid (DSL → SVG), the content IS the SVG — just validate it.
 */

export function renderSvgBlock(content: string): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  // Must start with <svg or <?xml (check for <svg followed by space, >, or /)
  if (!/^<svg[\s>/]/.test(trimmed) && !trimmed.startsWith("<?xml")) return null;

  const doc = new DOMParser().parseFromString(trimmed, "image/svg+xml");
  if (doc.querySelector("parsererror")) return null;

  // If it started with <?xml, verify the root element is <svg>
  if (doc.documentElement.tagName !== "svg") return null;

  return trimmed;
}
