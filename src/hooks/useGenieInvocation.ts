/**
 * Genie Invocation Hook
 *
 * Orchestrates the full AI genie pipeline:
 * extract content → fill template → invoke provider → stream → create suggestion
 */

import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { toast } from "sonner";
import type { GenieDefinition, GenieScope, GenieAction, AiResponseChunk } from "@/types/aiGenies";
import { useAiSuggestionStore } from "@/stores/aiSuggestionStore";
import { useAiProviderStore } from "@/stores/aiProviderStore";
import { useAiInvocationStore } from "@/stores/aiInvocationStore";
import { useEditorStore } from "@/stores/editorStore";
import { useTiptapEditorStore } from "@/stores/tiptapEditorStore";
import { useGeniesStore } from "@/stores/geniesStore";
import { useTabStore } from "@/stores/tabStore";

// ============================================================================
// Content Extraction
// ============================================================================

interface ExtractionResult {
  text: string;
  from: number;
  to: number;
}

function extractContent(scope: GenieScope): ExtractionResult | null {
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
      if (!selection.empty) {
        const text = doc.textBetween(selection.from, selection.to, "\n\n");
        return { text, from: selection.from, to: selection.to };
      }
      // No selection — use current block (paragraph) instead
      const $sel = selection.$from;
      const selDepth = $sel.depth;
      const selStart = $sel.start(selDepth);
      const selEnd = $sel.end(selDepth);
      const selText = doc.textBetween(selStart, selEnd, "\n\n");
      return { text: selText, from: selStart, to: selEnd };
    }

    case "block": {
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

export function useGenieInvocation() {
  const isRunning = useAiInvocationStore((s) => s.isRunning);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Cleanup listener on unmount
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);

  const cancel = useCallback(() => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    useAiInvocationStore.getState().cancel();
  }, []);

  const runGenie = useCallback(
    async (filledPrompt: string, extraction: ExtractionResult, model?: string, action: GenieAction = "replace") => {
      const providerState = useAiProviderStore.getState();
      const provider = providerState.activeProvider;
      if (!provider) return; // Callers ensure provider exists

      // Get REST config if applicable
      const restConfig = providerState.restProviders.find(
        (p) => p.type === provider
      );

      // Generate unique request ID
      const requestId = crypto.randomUUID();

      // Capture current tab ID for suggestion scoping
      const tabId = useTabStore.getState().activeTabId["main"] ?? "unknown";

      // Try to acquire the invocation lock
      if (!useAiInvocationStore.getState().tryStart(requestId)) {
        return; // Already running
      }

      let accumulated = "";

      // Listen for streamed response, filtering by request ID
      const unlisten = await listen<AiResponseChunk>("ai:response", (event) => {
        const chunk = event.payload;
        if (chunk.requestId !== requestId) return;

        if (chunk.error) {
          toast.error(chunk.error);
          cancel();
          return;
        }

        accumulated += chunk.chunk;

        if (chunk.done) {
          // Create suggestion from accumulated result
          if (accumulated.trim()) {
            const isInsert = action === "insert";
            useAiSuggestionStore.getState().addSuggestion({
              tabId,
              type: isInsert ? "insert" : "replace",
              from: isInsert ? extraction.to : extraction.from,
              to: extraction.to,
              newContent: accumulated.trim(),
              originalContent: isInsert ? "" : extraction.text,
            });
          }
          cancel();
        }
      });

      unlistenRef.current = unlisten;

      try {
        await invoke("run_ai_prompt", {
          requestId,
          provider,
          prompt: filledPrompt,
          model: model ?? restConfig?.model ?? null,
          apiKey: restConfig?.apiKey ?? null,
          endpoint: restConfig?.endpoint ?? null,
        });
      } catch (e) {
        toast.error(`Failed to invoke AI genie: ${e}`);
        cancel();
      }
    },
    [cancel]
  );

  const invokeGenie = useCallback(
    async (genie: GenieDefinition, scopeOverride?: GenieScope) => {
      // Block in Source Mode — suggestions can only apply via Tiptap
      if (useEditorStore.getState().sourceMode) {
        toast.info("Genies are not available in Source Mode");
        return;
      }

      // Auto-detect provider if none selected
      const hasProvider = await useAiProviderStore.getState().ensureProvider();
      if (!hasProvider) {
        toast.error("No AI provider available. Configure one in Settings.");
        return;
      }

      const scope = scopeOverride ?? genie.metadata.scope;
      const extracted = extractContent(scope);
      if (!extracted) {
        console.warn("No content to extract for scope:", scope);
        return;
      }

      const filled = fillTemplate(genie.template, extracted.text);

      // Track genie as recent
      useGeniesStore.getState().addRecent(genie.metadata.name);

      await runGenie(filled, extracted, genie.metadata.model, genie.metadata.action ?? "replace");
    },
    [runGenie]
  );

  const invokeFreeform = useCallback(
    async (userPrompt: string, scope: GenieScope) => {
      // Block in Source Mode — suggestions can only apply via Tiptap
      if (useEditorStore.getState().sourceMode) {
        toast.info("Genies are not available in Source Mode");
        return;
      }

      // Auto-detect provider if none selected
      const hasProvider = await useAiProviderStore.getState().ensureProvider();
      if (!hasProvider) {
        toast.error("No AI provider available. Configure one in Settings.");
        return;
      }

      const extracted = extractContent(scope);
      if (!extracted) {
        console.warn("No content to extract for scope:", scope);
        return;
      }

      const filled = `${userPrompt}\n\n${extracted.text}`;
      await runGenie(filled, extracted);
    },
    [runGenie]
  );

  return { invokeGenie, invokeFreeform, isRunning, cancel };
}
