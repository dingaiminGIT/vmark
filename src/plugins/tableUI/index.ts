/**
 * Table UI Plugin
 *
 * Provides visual table editing with context menu, column resizing, and keyboard navigation.
 * Toolbar functionality has been moved to the merged format toolbar.
 */

import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey, PluginView } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Ctx } from "@milkdown/kit/ctx";
import { editorViewCtx } from "@milkdown/kit/core";
import { TableContextMenu } from "./TableContextMenu";
import { ColumnResizeManager } from "./columnResize";
import { createTableKeymapCommands } from "./tableKeymap";
import { isInTable } from "./table-utils";

/**
 * Plugin state interface for storing context menu reference.
 */
interface TableUIPluginState {
  contextMenu: TableContextMenu | null;
}

export const tableUIPluginKey = new PluginKey<TableUIPluginState>("tableUI");

// Editor getter type
type EditorGetter = () => { action: (fn: (ctx: Ctx) => void) => void } | undefined;

/**
 * Plugin view that manages TableContextMenu and ColumnResizeManager.
 * Toolbar functionality has been moved to the merged format toolbar.
 */
class TableUIPluginView implements PluginView {
  private contextMenu: TableContextMenu;
  private columnResize: ColumnResizeManager;
  private view: EditorView;

  constructor(view: EditorView, ctx: Ctx) {
    this.view = view;

    // Create editor getter that wraps context for command execution
    const getEditor: EditorGetter = () => {
      try {
        // Verify context is still valid
        ctx.get(editorViewCtx);
        // Return wrapper for command execution
        return {
          action: (fn: (ctx: Ctx) => void) => fn(ctx),
        };
      } catch {
        return undefined;
      }
    };

    this.contextMenu = new TableContextMenu(view, getEditor);
    this.columnResize = new ColumnResizeManager(view);

    // Store context menu in plugin state via transaction
    const tr = view.state.tr.setMeta(tableUIPluginKey, { contextMenu: this.contextMenu });
    view.dispatch(tr);
  }

  update(view: EditorView) {
    // Only update resize handles when cursor is in table - avoids querying
    // off-screen table positions which can trigger unwanted scroll
    if (isInTable(view)) {
      this.columnResize.scheduleUpdate();
    }
  }

  destroy() {
    this.contextMenu.destroy();
    this.columnResize.destroy();

    // Clear plugin state
    const tr = this.view.state.tr.setMeta(tableUIPluginKey, { contextMenu: null });
    // Only dispatch if view is still valid
    try {
      this.view.dispatch(tr);
    } catch {
      // View may already be destroyed
    }
  }
}

/**
 * Table UI plugin for Milkdown.
 */
export const tableUIPlugin = $prose((ctx) => {
  return new Plugin<TableUIPluginState>({
    key: tableUIPluginKey,
    state: {
      init: () => ({ contextMenu: null }),
      apply: (tr, value) => {
        const meta = tr.getMeta(tableUIPluginKey);
        if (meta) {
          return { ...value, ...meta };
        }
        return value;
      },
    },
    view(editorView) {
      return new TableUIPluginView(editorView, ctx);
    },
    props: {
      handleDOMEvents: {
        // Show context menu on right-click in table
        contextmenu: (view, event) => {
          if (!isInTable(view)) return false;

          // Prevent default context menu
          event.preventDefault();

          // Get context menu from plugin state
          const pluginState = tableUIPluginKey.getState(view.state);
          if (pluginState?.contextMenu) {
            pluginState.contextMenu.show(event.clientX, event.clientY);
          }

          return true;
        },
      },
    },
  });
});

/**
 * Table keyboard navigation plugin.
 */
export const tableKeymapPlugin = $prose((ctx) => {
  return createTableKeymapCommands(ctx);
});

export default tableUIPlugin;
