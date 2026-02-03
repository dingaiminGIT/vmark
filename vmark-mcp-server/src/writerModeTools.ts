/**
 * Writer Mode Tool List
 *
 * These are the tools exposed in "Writer" mode — focused on reading and writing
 * content rather than low-level editor manipulation.
 *
 * Total: ~15 tools (down from 76 in Full mode)
 */

export const WRITER_MODE_TOOLS = [
  // === Understand document ===
  'get_document_digest', // Overview, outline, word counts
  'document_search', // Find content

  // === Read content ===
  'get_section', // Read section by heading
  'document_get_content', // Full document (fallback)

  // === Write content ===
  'update_section', // Modify section content
  'insert_section', // Add new section
  'move_section', // Reorder sections

  // === Control ===
  'editor_undo', // Fix mistakes
  'editor_redo', // Redo

  // === Suggestions ===
  'suggestion_list', // See pending suggestions
  'suggestion_accept', // Accept a suggestion
  'suggestion_reject', // Reject a suggestion

  // === Files ===
  'workspace_save_document', // Save
  'tabs_switch', // Switch documents
  'tabs_list', // List open tabs
] as const;

export type WriterModeTool = (typeof WRITER_MODE_TOOLS)[number];

/**
 * Check if a tool is included in writer mode.
 */
export function isWriterModeTool(toolName: string): boolean {
  return (WRITER_MODE_TOOLS as readonly string[]).includes(toolName);
}
