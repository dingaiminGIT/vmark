/**
 * Quick Action Chips
 *
 * Pre-built action buttons shown when picker is opened with filterScope: "selection".
 */

import type { PromptDefinition } from "@/types/aiPrompts";

const QUICK_ACTIONS = [
  { label: "Improve", promptName: "improve-writing" },
  { label: "Shorten", promptName: "shorten-text" },
  { label: "Fix Grammar", promptName: "fix-grammar" },
  { label: "Tone", promptName: "change-tone" },
];

interface PromptChipsProps {
  prompts: PromptDefinition[];
  onSelect: (prompt: PromptDefinition) => void;
}

export function PromptChips({ prompts, onSelect }: PromptChipsProps) {
  const available = QUICK_ACTIONS.filter((action) =>
    prompts.some((p) => p.metadata.name === action.promptName)
  );

  if (available.length === 0) return null;

  return (
    <div className="prompt-chips">
      {available.map((action) => {
        const prompt = prompts.find(
          (p) => p.metadata.name === action.promptName
        );
        if (!prompt) return null;
        return (
          <button
            key={action.promptName}
            className="prompt-chip"
            onClick={() => onSelect(prompt)}
            type="button"
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
