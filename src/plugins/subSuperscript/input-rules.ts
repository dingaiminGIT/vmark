/**
 * Input Rules for Subscript/Superscript
 *
 * Enables live typing: ~text~ and ^text^ auto-format as you type.
 */

import { $inputRule } from "@milkdown/kit/utils";
import { InputRule } from "@milkdown/kit/prose/inputrules";
import { subscriptSchema, superscriptSchema } from "./marks";

/**
 * Subscript input rule
 * Typing ~text~ converts to subscript
 */
export const subscriptInputRule = $inputRule((ctx) => {
  const markType = subscriptSchema.type(ctx);
  return new InputRule(
    // Match ~text~ at end of input (not ~~)
    /(?:^|[^~])~([^~\s][^~]*[^~\s]|[^~\s])~$/,
    (state, match, start, end) => {
      const text = match[1];
      if (!text) return null;

      // Adjust start if we captured a non-tilde char before
      const actualStart = match[0].startsWith("~") ? start : start + 1;

      return state.tr
        .delete(actualStart, end)
        .insertText(text, actualStart)
        .addMark(actualStart, actualStart + text.length, markType.create());
    }
  );
});

/**
 * Superscript input rule
 * Typing ^text^ converts to superscript
 */
export const superscriptInputRule = $inputRule((ctx) => {
  const markType = superscriptSchema.type(ctx);
  return new InputRule(
    // Match ^text^ at end of input
    /\^([^^]+)\^$/,
    (state, match, start, end) => {
      const text = match[1];
      if (!text) return null;

      return state.tr
        .delete(start, end)
        .insertText(text, start)
        .addMark(start, start + text.length, markType.create());
    }
  );
});
