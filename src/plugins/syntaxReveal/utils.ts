/**
 * Syntax Reveal Plugin - Shared Utilities
 */

import { Decoration } from "@milkdown/kit/prose/view";

/**
 * Create a syntax widget element factory
 */
export function createSyntaxWidget(text: string, type: string) {
  return () => {
    const span = document.createElement("span");
    span.className = `syntax-marker syntax-marker-${type}`;
    span.textContent = text;
    span.contentEditable = "false";
    return span;
  };
}

/**
 * Add a widget decoration to the decorations array
 */
export function addWidgetDecoration(
  decorations: Decoration[],
  pos: number,
  text: string,
  type: string,
  side: -1 | 1 = -1
) {
  decorations.push(
    Decoration.widget(pos, createSyntaxWidget(text, type), { side })
  );
}
