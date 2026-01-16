import type { EditorState } from "@tiptap/pm/state";
import { SelectionRange } from "@tiptap/pm/state";

export interface CodeBlockBounds {
  from: number;
  to: number;
}

export function getCodeBlockBounds(state: EditorState, pos: number): CodeBlockBounds | null {
  const $pos = state.doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === "codeBlock" || node.type.name === "code_block") {
      return { from: $pos.start(depth), to: $pos.end(depth) };
    }
  }
  return null;
}

export function filterRangesToBounds(
  ranges: readonly SelectionRange[],
  bounds: CodeBlockBounds
): SelectionRange[] {
  return ranges.filter((range) => range.$from.pos >= bounds.from && range.$to.pos <= bounds.to);
}
