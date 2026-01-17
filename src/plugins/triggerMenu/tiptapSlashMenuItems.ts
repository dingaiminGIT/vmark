import { emit } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { useSettingsStore } from "@/stores/settingsStore";
import type { SlashMenuItem } from "./tiptapSlashMenuUtils";

type AiCommandId =
  | "ask"
  | "summarize"
  | "rewrite"
  | "improve"
  | "fix-grammar"
  | "translate"
  | "continue"
  | "explain";

const icons = {
  spark: `<svg viewBox="0 0 24 24"><path d="M12 3l2.2 5.5L20 11l-5.8 2.5L12 19l-2.2-5.5L4 11l5.8-2.5z"/></svg>`,
};

const AI_COMMANDS: { id: AiCommandId; label: string; keywords: string[] }[] = [
  { id: "ask", label: "Ask AI...", keywords: ["prompt", "custom", "chat", "ask"] },
  { id: "summarize", label: "Summarize", keywords: ["summary", "tldr", "short"] },
  { id: "rewrite", label: "Rewrite", keywords: ["rephrase", "paraphrase"] },
  { id: "improve", label: "Improve clarity", keywords: ["polish", "refine", "clarify"] },
  { id: "fix-grammar", label: "Fix grammar", keywords: ["grammar", "typo", "spelling"] },
  { id: "translate", label: "Translate...", keywords: ["translate", "language"] },
  { id: "continue", label: "Continue writing", keywords: ["continue", "expand", "complete"] },
  { id: "explain", label: "Explain", keywords: ["explain", "eli5", "simplify"] },
];

function emitAiCommand(editor: TiptapEditor, commandId: AiCommandId, query: string) {
  const commandMenuEnabled = useSettingsStore.getState().advanced?.enableCommandMenu ?? false;
  if (!commandMenuEnabled) return;
  const windowLabel = getCurrentWebviewWindow().label;
  const { selection, doc } = editor.state;
  const selectionPayload = selection.empty
    ? null
    : {
        from: selection.from,
        to: selection.to,
        text: doc.textBetween(selection.from, selection.to, "\n", "\n"),
      };

  const trigger = useSettingsStore.getState().ai?.commandTrigger ?? "// ";
  void emit("ai:command", {
    windowLabel,
    commandId,
    query: query.trim(),
    selection: selectionPayload,
    surface: "wysiwyg",
    trigger,
  });
}

export function createSlashMenuItems(editor: TiptapEditor): SlashMenuItem[] {
  return AI_COMMANDS.map((command) => ({
    label: command.label,
    icon: icons.spark,
    group: "AI",
    keywords: command.keywords,
    action: (context) => emitAiCommand(editor, command.id, context.query),
  }));
}
