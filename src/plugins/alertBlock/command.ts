/**
 * Alert Block Commands
 *
 * Commands to insert alert blocks via menu
 */

import { $command } from "@milkdown/kit/utils";
import { Selection } from "@milkdown/kit/prose/state";
import { alertBlockSchema } from "./node";
import type { AlertType } from "./remark-plugin";

/**
 * Insert alert block command
 */
export const insertAlertBlockCommand = $command(
  "InsertAlertBlock",
  (ctx) => (alertType: AlertType = "NOTE") => (state, dispatch) => {
    const alertBlockType = alertBlockSchema.type(ctx);
    const paragraphType = state.schema.nodes.paragraph;

    if (!paragraphType) return false;

    // Create empty paragraph for content
    const contentNode = paragraphType.create();

    // Create alert block with the specified type
    const alertNode = alertBlockType.create({ alertType }, [contentNode]);

    if (dispatch) {
      // Insert at current position
      const { $from } = state.selection;

      // Find the end of current block to insert after
      const insertPos = $from.end($from.depth) + 1;

      // Create transaction
      const tr = state.tr.insert(insertPos, alertNode);

      // Move cursor into the new alert block's content
      const newPos = insertPos + 2; // +1 for alert block, +1 for paragraph
      tr.setSelection(Selection.near(tr.doc.resolve(newPos)));

      dispatch(tr.scrollIntoView());
    }

    return true;
  }
);
