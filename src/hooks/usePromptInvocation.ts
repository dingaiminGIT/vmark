/**
 * Prompt Invocation Hook
 *
 * Orchestrates the full AI prompt pipeline:
 * extract content → fill template → invoke provider → stream → create suggestion
 */

import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { PromptDefinition, PromptScope, AiResponseChunk } from "@/types/aiPrompts";
import { useAiSuggestionStore } from "@/stores/aiSuggestionStore";
import { useAiProviderStore } from "@/stores/aiProviderStore";
import { useEditorStore } from "@/stores/editorStore";
import { useTiptapEditorStore } from "@/stores/tiptapEditorStore";
import { usePromptsStore } from "@/stores/promptsStore";

// ============================================================================
// Content Extraction
// ============================================================================

interface ExtractionResult {
  text: string;
  from: number;
  to: number;
}

function extractContent(scope: PromptScope): ExtractionResult | null {
  const editor = useTiptapEditorStore.getState().editor;
  const sourceMode = useEditorStore.getState().sourceMode;

  if (sourceMode) {
    // In source mode, use raw content string
    const content = useEditorStore.getState().content;
    if (scope === "document") {
      return { text: content, from: 0, to: content.length };
    }
    // For selection/block in source mode, we don't have ProseMirror — use full content
    return { text: content, from: 0, to: content.length };
  }

  if (!editor) return null;

  const { state } = editor;
  const { doc, selection } = state;

  switch (scope) {
    case "selection": {
      if (selection.empty) return null;
      const text = doc.textBetween(selection.from, selection.to, "\n\n");
      return { text, from: selection.from, to: selection.to };
    }

    case "block": {
      // Resolve to the block node containing cursor
      const $pos = selection.$from;
      const depth = $pos.depth;
      const start = $pos.start(depth);
      const end = $pos.end(depth);
      const text = doc.textBetween(start, end, "\n\n");
      return { text, from: start, to: end };
    }

    case "document": {
      const text = doc.textBetween(0, doc.content.size, "\n\n");
      return { text, from: 0, to: doc.content.size };
    }

    default:
      return null;
  }
}

// ============================================================================
// Template Filling
// ============================================================================

function fillTemplate(template: string, content: string): string {
  return template.replace(/\{\{content\}\}/g, content);
}

// ============================================================================
// Hook
// ============================================================================

export function usePromptInvocation() {
  const [isRunning, setIsRunning] = useState(false);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const cancel = useCallback(() => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const invokePrompt = useCallback(
    async (prompt: PromptDefinition, scopeOverride?: PromptScope) => {
      const scope = scopeOverride ?? prompt.metadata.scope;
      const extracted = extractContent(scope);
      if (!extracted) {
        console.warn("No content to extract for scope:", scope);
        return;
      }

      const filled = fillTemplate(prompt.template, extracted.text);

      // Track prompt as recent
      usePromptsStore.getState().addRecent(prompt.metadata.name);

      await runPrompt(filled, extracted, prompt.metadata.model);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const invokeFreeform = useCallback(
    async (userPrompt: string, scope: PromptScope) => {
      const extracted = extractContent(scope);
      if (!extracted) {
        console.warn("No content to extract for scope:", scope);
        return;
      }

      const filled = `${userPrompt}\n\n${extracted.text}`;
      await runPrompt(filled, extracted);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const runPrompt = useCallback(
    async (filledPrompt: string, extraction: ExtractionResult, model?: string) => {
      const providerState = useAiProviderStore.getState();
      const provider = providerState.activeProvider;
      if (!provider) {
        console.error("No active AI provider");
        return;
      }

      // Get REST config if applicable
      const restConfig = providerState.restProviders.find(
        (p) => p.type === provider
      );

      setIsRunning(true);
      let accumulated = "";

      // Listen for streamed response
      const unlisten = await listen<AiResponseChunk>("ai:response", (event) => {
        const chunk = event.payload;
        if (chunk.error) {
          console.error("AI error:", chunk.error);
          cancel();
          return;
        }

        accumulated += chunk.chunk;

        if (chunk.done) {
          // Create suggestion from accumulated result
          if (accumulated.trim()) {
            useAiSuggestionStore.getState().addSuggestion({
              type: "replace",
              from: extraction.from,
              to: extraction.to,
              newContent: accumulated.trim(),
              originalContent: extraction.text,
            });
          }
          cancel();
        }
      });

      unlistenRef.current = unlisten;

      try {
        await invoke("run_ai_prompt", {
          provider,
          prompt: filledPrompt,
          model: model ?? restConfig?.model ?? null,
          apiKey: restConfig?.apiKey ?? null,
          endpoint: restConfig?.endpoint ?? null,
        });
      } catch (e) {
        console.error("Failed to invoke AI prompt:", e);
        cancel();
      }
    },
    [cancel]
  );

  return { invokePrompt, invokeFreeform, isRunning, cancel };
}
