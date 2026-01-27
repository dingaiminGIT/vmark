/**
 * MCP Bridge Utilities
 */

import { invoke } from "@tauri-apps/api/core";
import { useTiptapEditorStore } from "@/stores/tiptapEditorStore";
import { serializeMarkdown } from "@/utils/markdownPipeline";
import type { McpResponse } from "./types";

/**
 * Send response back to the MCP bridge.
 */
export async function respond(response: McpResponse): Promise<void> {
  try {
    await invoke("mcp_bridge_respond", { payload: response });
  } catch (error) {
    console.error("[MCP Bridge] Failed to send response:", error);
  }
}

/**
 * Get the current editor instance.
 */
export function getEditor() {
  return useTiptapEditorStore.getState().editor;
}

/**
 * Get the current document content as markdown.
 */
export function getDocumentContent(): string {
  const editor = getEditor();
  if (!editor) {
    throw new Error("No active editor");
  }
  return serializeMarkdown(editor.state.schema, editor.state.doc);
}

/**
 * Resolve windowId parameter to actual window label.
 * Maps "focused" to the currently focused window (currently always "main").
 * Defaults undefined to "main".
 */
export function resolveWindowId(windowId: string | undefined): string {
  if (windowId === "focused") {
    // For now, VMark is single-window, so "focused" always means "main"
    // Future: look up actual focused window from window manager
    return "main";
  }
  return windowId ?? "main";
}
