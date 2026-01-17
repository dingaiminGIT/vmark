import type { EditorView } from "@tiptap/pm/view";
import { useSettingsStore } from "@/stores/settingsStore";
import { parseTrigger } from "./tiptapSlashMenuUtils";

export type SlashMatch = {
  query: string;
  range: { from: number; to: number };
  coords: ReturnType<EditorView["coordsAtPos"]>;
};

function isInCodeBlock(view: EditorView): boolean {
  const { $from } = view.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name;
    if (name === "codeBlock" || name === "code_block") return true;
  }
  return false;
}

export function findSlashMenuMatch(view: EditorView): SlashMatch | null {
  const { state } = view;
  const commandMenuEnabled = useSettingsStore.getState().advanced?.enableCommandMenu ?? false;
  if (!commandMenuEnabled) return null;
  if (!state.selection.empty) return null;
  if (isInCodeBlock(view)) return null;

  const { $from } = state.selection;
  if (!$from.parent.isTextblock) return null;

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, "\n", "\n");
  const trigger = useSettingsStore.getState().ai?.commandTrigger ?? "// ";
  const parsed = parseTrigger(textBefore, trigger);
  if (!parsed) return null;

  const from = $from.start() + parsed.triggerIndex;
  const to = $from.pos;

  return { query: parsed.query, range: { from, to }, coords: view.coordsAtPos(to) };
}
