/**
 * MCP Bridge Types
 */

/** Raw event from Tauri IPC - args is JSON string to avoid double-encoding */
export interface McpRequestEventRaw {
  id: string;
  type: string;
  /** Snake case (as defined in Rust) */
  args_json?: string;
  /** CamelCase (Tauri might convert) */
  argsJson?: string;
}

/** Parsed event with args as object */
export interface McpRequestEvent {
  id: string;
  type: string;
  args: Record<string, unknown>;
}

export interface McpResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}
