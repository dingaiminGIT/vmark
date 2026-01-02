/**
 * Subscript/Superscript Plugin
 *
 * Adds support for ~subscript~ and ^superscript^ markdown syntax.
 *
 * Features:
 * - Mark schemas for subscript and superscript
 * - Remark plugin for parsing markdown
 * - Input rules for live typing
 * - Toggle commands for programmatic control
 */

import { subscriptSchema, superscriptSchema } from "./marks";
import { remarkSubSuperscriptPlugin } from "./remark-plugin";
import { subscriptInputRule, superscriptInputRule } from "./input-rules";
import { toggleSubscriptCommand, toggleSuperscriptCommand } from "./commands";

// Re-export individual components
export {
  subscriptSchema,
  superscriptSchema,
  remarkSubSuperscriptPlugin,
  subscriptInputRule,
  superscriptInputRule,
  toggleSubscriptCommand,
  toggleSuperscriptCommand,
};

/**
 * Combined plugin array for easy registration
 * Usage: .use(subSuperscriptPlugin.flat())
 */
export const subSuperscriptPlugin = [
  // Remark plugin for parsing markdown
  remarkSubSuperscriptPlugin,
  // Mark schemas
  subscriptSchema,
  superscriptSchema,
  // Input rules for live typing
  subscriptInputRule,
  superscriptInputRule,
  // Toggle commands
  toggleSubscriptCommand,
  toggleSuperscriptCommand,
];
