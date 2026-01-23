/**
 * Previously disabled the default browser context menu in production.
 *
 * Now a no-op because:
 * - Tauri release builds don't expose devtools in context menu anyway
 * - Blocking prevents useful system features (Copy, Paste, Spell Check)
 * - Custom context menus (images, tables) already call preventDefault()
 */
export function useDisableContextMenu() {
  // No-op: allow system context menu everywhere
}
