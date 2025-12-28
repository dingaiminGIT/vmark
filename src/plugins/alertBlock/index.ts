/**
 * GitHub-style Alert Block Plugin
 *
 * Supports: NOTE, TIP, IMPORTANT, WARNING, CAUTION
 *
 * Usage:
 * > [!NOTE]
 * > This is a note
 */

import { remarkAlertPlugin } from "./remark-plugin";
import { alertBlockSchema, alertTypeAttr } from "./node";
import { alertBlockInputRule } from "./input-rule";
import { insertAlertBlockCommand } from "./command";

export { ALERT_TYPES, type AlertType } from "./remark-plugin";
export { insertAlertBlockCommand } from "./command";

/**
 * Complete alert block plugin for Milkdown
 *
 * Includes:
 * - Remark plugin for parsing > [!TYPE] syntax
 * - Node schema for rendering
 * - Input rule for typing > [!TYPE]
 */
export const alertBlockPlugin = [
  remarkAlertPlugin,
  alertTypeAttr,
  alertBlockSchema,
  alertBlockInputRule,
  insertAlertBlockCommand,
];

export default alertBlockPlugin;
