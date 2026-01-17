/**
 * MCP Bridge Hook - Handles MCP requests from AI assistants.
 *
 * Listens for mcp-bridge:request events from Tauri and executes
 * the corresponding editor operations.
 */

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useTiptapEditorStore } from "@/stores/tiptapEditorStore";
import { useDocumentStore } from "@/stores/documentStore";
import { useTabStore } from "@/stores/tabStore";
import { parseMarkdown, serializeMarkdown } from "@/utils/markdownPipeline";

interface McpRequestEvent {
  id: string;
  type: string;
  args: Record<string, unknown>;
}

interface McpResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Send response back to the MCP bridge.
 */
async function respond(response: McpResponse): Promise<void> {
  try {
    await invoke("mcp_bridge_respond", { payload: response });
  } catch (error) {
    console.error("[MCP Bridge] Failed to send response:", error);
  }
}

/**
 * Get the current editor instance.
 */
function getEditor() {
  return useTiptapEditorStore.getState().editor;
}

/**
 * Get the current document content as markdown.
 */
function getDocumentContent(): string {
  const editor = getEditor();
  if (!editor) {
    throw new Error("No active editor");
  }
  return serializeMarkdown(editor.state.schema, editor.state.doc);
}

/**
 * Handle document.getContent request.
 */
async function handleGetContent(id: string): Promise<void> {
  try {
    const content = getDocumentContent();
    await respond({ id, success: true, data: content });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle document.setContent request.
 */
async function handleSetContent(
  id: string,
  args: Record<string, unknown>
): Promise<void> {
  try {
    const editor = getEditor();
    if (!editor) throw new Error("No active editor");

    const content = args.content as string;
    if (typeof content !== "string") {
      throw new Error("content must be a string");
    }

    // Parse markdown to ProseMirror document for proper WYSIWYG rendering
    const parsedDoc = parseMarkdown(editor.state.schema, content);
    // Set the full document content
    editor.commands.setContent(parsedDoc.toJSON());

    await respond({ id, success: true, data: null });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle document.insertAtCursor request.
 */
async function handleInsertAtCursor(
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

    // Parse markdown to ProseMirror nodes for proper WYSIWYG rendering
    const parsedDoc = parseMarkdown(editor.state.schema, text);
    // Insert the parsed content (excluding the doc wrapper)
    editor.commands.insertContent(parsedDoc.content.toJSON());

    await respond({ id, success: true, data: null });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle selection.get request.
 */
async function handleSelectionGet(id: string): Promise<void> {
  try {
    const editor = getEditor();
    if (!editor) throw new Error("No active editor");

    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, "\n");

    await respond({
      id,
      success: true,
      data: {
        text,
        range: { from, to },
        isEmpty: from === to,
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
 * Handle selection.set request.
 */
async function handleSelectionSet(
  id: string,
  args: Record<string, unknown>
): Promise<void> {
  try {
    const editor = getEditor();
    if (!editor) throw new Error("No active editor");

    const from = args.from as number;
    const to = args.to as number;

    editor.commands.setTextSelection({ from, to });

    await respond({ id, success: true, data: null });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle selection.replace request.
 */
async function handleSelectionReplace(
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
    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContentAt(from, text)
      .run();

    await respond({ id, success: true, data: null });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle selection.delete request.
 */
async function handleSelectionDelete(id: string): Promise<void> {
  try {
    const editor = getEditor();
    if (!editor) throw new Error("No active editor");

    editor.commands.deleteSelection();

    await respond({ id, success: true, data: null });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle cursor.getContext request.
 */
async function handleCursorGetContext(
  id: string,
  args: Record<string, unknown>
): Promise<void> {
  try {
    const editor = getEditor();
    if (!editor) throw new Error("No active editor");

    const { from } = editor.state.selection;
    const doc = editor.state.doc;
    const text = doc.textContent;

    // Find current line
    let lineStart = from;
    while (lineStart > 0 && text[lineStart - 1] !== "\n") lineStart--;
    let lineEnd = from;
    while (lineEnd < text.length && text[lineEnd] !== "\n") lineEnd++;

    const currentLine = text.slice(lineStart, lineEnd);

    // Get context lines
    const linesBefore = (args.linesBefore as number) ?? 5;
    const linesAfter = (args.linesAfter as number) ?? 5;

    const lines = text.split("\n");
    let currentLineIndex = 0;
    let pos = 0;
    for (let i = 0; i < lines.length; i++) {
      if (pos + lines[i].length >= from) {
        currentLineIndex = i;
        break;
      }
      pos += lines[i].length + 1;
    }

    const beforeLines = lines
      .slice(Math.max(0, currentLineIndex - linesBefore), currentLineIndex)
      .join("\n");
    const afterLines = lines
      .slice(currentLineIndex + 1, currentLineIndex + 1 + linesAfter)
      .join("\n");

    await respond({
      id,
      success: true,
      data: {
        before: beforeLines,
        after: afterLines,
        currentLine,
        currentParagraph: currentLine, // Simplified
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
 * Handle cursor.setPosition request.
 */
async function handleCursorSetPosition(
  id: string,
  args: Record<string, unknown>
): Promise<void> {
  try {
    const editor = getEditor();
    if (!editor) throw new Error("No active editor");

    const position = args.position as number;
    editor.commands.setTextSelection(position);

    await respond({ id, success: true, data: null });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle format.toggle request.
 */
async function handleFormatToggle(
  id: string,
  args: Record<string, unknown>
): Promise<void> {
  try {
    const editor = getEditor();
    if (!editor) throw new Error("No active editor");

    const format = (args.format ?? args.mark) as string;

    switch (format) {
      case "bold":
        editor.commands.toggleBold();
        break;
      case "italic":
        editor.commands.toggleItalic();
        break;
      case "code":
        editor.commands.toggleCode();
        break;
      case "strike":
        editor.commands.toggleStrike();
        break;
      default:
        throw new Error(`Unknown format: ${format}`);
    }

    await respond({ id, success: true, data: null });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle editor.undo request.
 */
async function handleUndo(id: string): Promise<void> {
  try {
    const editor = getEditor();
    if (!editor) throw new Error("No active editor");

    editor.commands.undo();

    await respond({ id, success: true, data: null });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle editor.redo request.
 */
async function handleRedo(id: string): Promise<void> {
  try {
    const editor = getEditor();
    if (!editor) throw new Error("No active editor");

    editor.commands.redo();

    await respond({ id, success: true, data: null });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle editor.focus request.
 */
async function handleFocus(id: string): Promise<void> {
  try {
    const editor = getEditor();
    if (!editor) throw new Error("No active editor");

    editor.commands.focus();

    await respond({ id, success: true, data: null });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Handle windows.list request.
 */
async function handleWindowsList(id: string): Promise<void> {
  try {
    // For now, return a single focused window
    // Multi-window support can be added later
    const tabStore = useTabStore.getState();
    const docStore = useDocumentStore.getState();
    // activeTabId is keyed by window label
    const activeTabId = tabStore.activeTabId["main"];
    const doc = activeTabId ? docStore.getDocument(activeTabId) : undefined;

    await respond({
      id,
      success: true,
      data: [
        {
          label: "main",
          title: doc?.filePath?.split("/").pop() ?? "Untitled",
          filePath: doc?.filePath ?? null,
          isFocused: true,
          isAiExposed: true,
        },
      ],
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
 * Handle windows.getFocused request.
 */
async function handleWindowsGetFocused(id: string): Promise<void> {
  try {
    await respond({ id, success: true, data: "main" });
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Route MCP request to appropriate handler.
 */
async function handleRequest(event: McpRequestEvent): Promise<void> {
  const { id, type, args } = event;

  try {
    switch (type) {
      // Document operations
      case "document.getContent":
        await handleGetContent(id);
        break;
      case "document.setContent":
        await handleSetContent(id, args);
        break;
      case "document.insertAtCursor":
        await handleInsertAtCursor(id, args);
        break;

      // Selection operations
      case "selection.get":
        await handleSelectionGet(id);
        break;
      case "selection.set":
        await handleSelectionSet(id, args);
        break;
      case "selection.replace":
        await handleSelectionReplace(id, args);
        break;
      case "selection.delete":
        await handleSelectionDelete(id);
        break;

      // Cursor operations
      case "cursor.getContext":
        await handleCursorGetContext(id, args);
        break;
      case "cursor.setPosition":
        await handleCursorSetPosition(id, args);
        break;

      // Format operations
      case "format.toggle":
        await handleFormatToggle(id, args);
        break;

      // Editor operations
      case "editor.undo":
        await handleUndo(id);
        break;
      case "editor.redo":
        await handleRedo(id);
        break;
      case "editor.focus":
        await handleFocus(id);
        break;

      // Window operations
      case "windows.list":
        await handleWindowsList(id);
        break;
      case "windows.getFocused":
        await handleWindowsGetFocused(id);
        break;

      default:
        await respond({
          id,
          success: false,
          error: `Unknown request type: ${type}`,
        });
    }
  } catch (error) {
    await respond({
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Hook to enable MCP bridge request handling.
 * Should be used once in the main app component.
 */
export function useMcpBridge(): void {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<McpRequestEvent>("mcp-bridge:request", (event) => {
      handleRequest(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);
}
