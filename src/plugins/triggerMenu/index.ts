/**
 * Trigger Menu Plugin System
 *
 * A factory for creating trigger-based command menus.
 * Currently provides:
 * - "/" Slash menu for block insertion
 *
 * Future triggers:
 * - ":" Emoji picker
 * - "!" Callouts
 * - "~" AI transforms
 * - ">" Freeform prompts
 */

// Core exports
export { createTriggerMenu } from "./factory";
export type { TriggerMenuItem, TriggerMenuConfig } from "./types";

// Slash menu (/)
export { slashMenu, configureSlashMenu } from "./menus/slash";

// Import CSS
import "./trigger-menu.css";
