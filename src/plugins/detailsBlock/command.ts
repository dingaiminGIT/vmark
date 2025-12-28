/**
 * Details Block Commands
 *
 * Commands to insert collapsible details blocks via menu
 */

import { $command } from "@milkdown/kit/utils";
import { Selection } from "@milkdown/kit/prose/state";
import { detailsBlockSchema, detailsSummarySchema } from "./node";

/**
 * Insert details block command
 */
export const insertDetailsBlockCommand = $command(
  "InsertDetailsBlock",
  (ctx) => () => (state, dispatch) => {
    const detailsType = detailsBlockSchema.type(ctx);
    const summaryType = detailsSummarySchema.type(ctx);
    const paragraphType = state.schema.nodes.paragraph;

    if (!paragraphType) return false;

    // Create summary with default text
    const summaryNode = summaryType.create(
      null,
      state.schema.text("Click to expand")
    );

    // Create empty paragraph for content
    const contentNode = paragraphType.create();

    // Create details block (expanded by default for editing)
    const detailsNode = detailsType.create({ open: true }, [
      summaryNode,
      contentNode,
    ]);

    if (dispatch) {
      // Insert at current position
      const { $from } = state.selection;

      // Find the end of current block to insert after
      const insertPos = $from.end($from.depth) + 1;

      // Create transaction
      const tr = state.tr.insert(insertPos, detailsNode);

      // Move cursor into the content paragraph
      // Position: insertPos + 1 (enter details) + summaryNode.nodeSize + 1 (enter paragraph)
      const newPos = insertPos + 1 + summaryNode.nodeSize + 1;
      tr.setSelection(Selection.near(tr.doc.resolve(newPos)));

      dispatch(tr.scrollIntoView());
    }

    return true;
  }
);
