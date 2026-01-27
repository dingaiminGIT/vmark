/**
 * Table Scroll Wrapper Extension
 *
 * Extends the Table node to wrap in a scrollable container,
 * allowing wide tables to scroll horizontally and extend
 * beyond the editor's content padding.
 */

import { Table } from "@tiptap/extension-table";
import { withSourceLine } from "@/plugins/shared/sourceLineAttr";

/**
 * Custom Table extension that renders with a scroll wrapper.
 * The wrapper enables:
 * - Horizontal scrolling for wide tables
 * - Full-width extension (breaking out of content padding)
 */
export const TableWithScrollWrapper = withSourceLine(
  Table.extend({
    renderHTML({ HTMLAttributes }) {
      return [
        "div",
        { class: "table-scroll-wrapper" },
        ["table", HTMLAttributes, ["tbody", 0]],
      ];
    },
  })
);
