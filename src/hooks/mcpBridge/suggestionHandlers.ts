/**
 * MCP Bridge - AI Suggestion Handlers
 *
 * Wraps AI-generated content modifications in suggestions requiring user approval.
 * IMPORTANT: No document modifications until user accepts - preserves undo/redo integrity.
 */

import { useAiSuggestionStore } from "@/stores/aiSuggestionStore";
import { respond, getEditor } from "./utils";

/**
 * Handle document.setContent request - BLOCKED for AI safety.
 * AI should not be able to replace the entire document.
 */
export async function handleSetContentBlocked(id: string): Promise<void> {
  await respond({
    id,
    success: false,
    error:
      "document.setContent is disabled for AI safety. Use document.insertAtCursor or selection.replace instead.",
  });
}

/**
 * Handle document.insertAtCursor with suggestion wrapping.
 * Does NOT modify document - stores suggestion for preview decoration.
 * Document is only modified when user accepts.
 */
export async function handleInsertAtCursorWithSuggestion(
  id: string,
  args: Record<string, unknown>
): Promise<void> {
  try {
    const editor = getEditor();
    if (!editor) throw new Error("No active editor");

    const text = args.text as string;
    if (typeof text !== "string") {
      throw new Error("text must be a string");
    }

    // Get cursor position - this is where content will be inserted on accept
    const insertPos = editor.state.selection.from;

    // Create suggestion WITHOUT modifying the document
    // Content will be shown as ghost text decoration
    const suggestionId = useAiSuggestionStore.getState().addSuggestion({
      type: "insert",
      from: insertPos,
      to: insertPos, // Same position - insert point
      newContent: text,
    });

    await respond({
      id,
      success: true,
      data: {
        suggestionId,
        message: "Content staged as suggestion. Awaiting user approval.",
        position: insertPos,
      },
    });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle selection.replace with suggestion wrapping.
 * Does NOT modify document - stores both original and new content.
 * Original shown with strikethrough, new shown as ghost text.
 */
export async function handleSelectionReplaceWithSuggestion(
  id: string,
  args: Record<string, unknown>
): Promise<void> {
  try {
    const editor = getEditor();
    if (!editor) throw new Error("No active editor");

    const text = args.text as string;
    if (typeof text !== "string") {
      throw new Error("text must be a string");
    }

    const { from, to } = editor.state.selection;
    if (from === to) {
      // No selection - treat as insert at cursor
      return handleInsertAtCursorWithSuggestion(id, { text });
    }

    // Get original content that would be replaced
    const originalContent = editor.state.doc.textBetween(from, to, "\n");

    // Create suggestion WITHOUT modifying the document
    // Original content shown with strikethrough, new content as ghost text
    const suggestionId = useAiSuggestionStore.getState().addSuggestion({
      type: "replace",
      from,
      to,
      newContent: text,
      originalContent,
    });

    await respond({
      id,
      success: true,
      data: {
        suggestionId,
        message: "Replacement staged as suggestion. Awaiting user approval.",
        range: { from, to },
        originalContent,
      },
    });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle selection.delete with suggestion wrapping.
 * Marks content for deletion but doesn't actually delete until approved.
 */
export async function handleSelectionDeleteWithSuggestion(id: string): Promise<void> {
  try {
    const editor = getEditor();
    if (!editor) throw new Error("No active editor");

    const { from, to } = editor.state.selection;
    if (from === to) {
      throw new Error("No text selected");
    }

    // Get content that would be deleted
    const originalContent = editor.state.doc.textBetween(from, to, "\n");

    // Create suggestion - content shown with strikethrough decoration
    const suggestionId = useAiSuggestionStore.getState().addSuggestion({
      type: "delete",
      from,
      to,
      originalContent,
    });

    await respond({
      id,
      success: true,
      data: {
        suggestionId,
        message: "Content marked for deletion. Awaiting user approval.",
        range: { from, to },
        content: originalContent,
      },
    });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle suggestion.accept request.
 * Accepts a specific suggestion by ID.
 */
export async function handleSuggestionAccept(
  id: string,
  args: Record<string, unknown>
): Promise<void> {
  try {
    const suggestionId = args.suggestionId as string;
    if (typeof suggestionId !== "string") {
      throw new Error("suggestionId must be a string");
    }

    const store = useAiSuggestionStore.getState();
    const suggestion = store.getSuggestion(suggestionId);

    if (!suggestion) {
      throw new Error(`Suggestion not found: ${suggestionId}`);
    }

    store.acceptSuggestion(suggestionId);

    await respond({
      id,
      success: true,
      data: { message: "Suggestion accepted", suggestionId },
    });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle suggestion.reject request.
 * Rejects a specific suggestion by ID.
 */
export async function handleSuggestionReject(
  id: string,
  args: Record<string, unknown>
): Promise<void> {
  try {
    const suggestionId = args.suggestionId as string;
    if (typeof suggestionId !== "string") {
      throw new Error("suggestionId must be a string");
    }

    const store = useAiSuggestionStore.getState();
    const suggestion = store.getSuggestion(suggestionId);

    if (!suggestion) {
      throw new Error(`Suggestion not found: ${suggestionId}`);
    }

    store.rejectSuggestion(suggestionId);

    await respond({
      id,
      success: true,
      data: { message: "Suggestion rejected", suggestionId },
    });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle suggestion.list request.
 * Returns all pending suggestions.
 */
export async function handleSuggestionList(id: string): Promise<void> {
  try {
    const store = useAiSuggestionStore.getState();
    const suggestions = store.getSortedSuggestions().map((s) => ({
      id: s.id,
      type: s.type,
      from: s.from,
      to: s.to,
      newContent: s.newContent,
      originalContent: s.originalContent,
      createdAt: s.createdAt,
    }));

    await respond({
      id,
      success: true,
      data: {
        suggestions,
        count: suggestions.length,
        focusedId: store.focusedSuggestionId,
      },
    });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle suggestion.acceptAll request.
 * Accepts all pending suggestions.
 */
export async function handleSuggestionAcceptAll(id: string): Promise<void> {
  try {
    const store = useAiSuggestionStore.getState();
    const count = store.suggestions.size;

    store.acceptAll();

    await respond({
      id,
      success: true,
      data: { message: `Accepted ${count} suggestions`, count },
    });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle suggestion.rejectAll request.
 * Rejects all pending suggestions.
 */
export async function handleSuggestionRejectAll(id: string): Promise<void> {
  try {
    const store = useAiSuggestionStore.getState();
    const count = store.suggestions.size;

    store.rejectAll();

    await respond({
      id,
      success: true,
      data: { message: `Rejected ${count} suggestions`, count },
    });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
