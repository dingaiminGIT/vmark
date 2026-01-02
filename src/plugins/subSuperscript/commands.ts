/**
 * Toggle Commands for Subscript/Superscript
 *
 * Commands to toggle subscript and superscript marks on selection.
 */

import { $command } from "@milkdown/kit/utils";
import { toggleMark } from "@milkdown/kit/prose/commands";
import { subscriptSchema, superscriptSchema } from "./marks";

/**
 * Toggle subscript mark on current selection
 */
export const toggleSubscriptCommand = $command(
  "ToggleSubscript",
  (ctx) => () => toggleMark(subscriptSchema.type(ctx))
);

/**
 * Toggle superscript mark on current selection
 */
export const toggleSuperscriptCommand = $command(
  "ToggleSuperscript",
  (ctx) => () => toggleMark(superscriptSchema.type(ctx))
);
