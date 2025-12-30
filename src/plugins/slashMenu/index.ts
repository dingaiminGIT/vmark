/**
 * Slash Menu Plugin
 *
 * Provides a "/" command menu for inserting blocks.
 * Uses Kit's SlashProvider with custom UI and proper keyboard handling.
 */

import { SlashProvider, slashFactory } from "@milkdown/kit/plugin/slash";
import type { Ctx } from "@milkdown/kit/ctx";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { PluginView } from "@milkdown/kit/prose/state";
import { TextSelection } from "@milkdown/kit/prose/state";

import { menuItems, type SlashMenuItem } from "./menuItems";
import "./slash-menu.css";

// Create the slash plugin instance
export const slashMenu = slashFactory("VMARK_SLASH");

/**
 * Configure the slash menu plugin.
 */
export function configureSlashMenu(ctx: Ctx) {
  ctx.set(slashMenu.key, {
    view: (view) => new SlashMenuView(ctx, view),
  });
}

/**
 * Check if selection is in a code block.
 */
function isInCodeBlock(view: EditorView): boolean {
  const { $from } = view.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "code_block") {
      return true;
    }
  }
  return false;
}

/**
 * Slash menu view - manages the popup UI.
 */
class SlashMenuView implements PluginView {
  private container: HTMLElement;
  private slashProvider: SlashProvider;
  private filter = "";
  private selectedIndex = 0;
  private filteredItems: SlashMenuItem[] = [];
  private isVisible = false;
  private editorView: EditorView;

  constructor(
    private ctx: Ctx,
    view: EditorView
  ) {
    this.editorView = view;

    // Create container element
    this.container = document.createElement("div");
    this.container.className = "slash-menu";
    this.container.style.display = "none";

    // Initialize slash provider
    this.slashProvider = new SlashProvider({
      content: this.container,
      debounce: 50,
      shouldShow: (view) => {
        // Don't show in code blocks
        if (isInCodeBlock(view)) return false;

        // Get the text content before cursor
        const { selection } = view.state;
        if (!(selection instanceof TextSelection)) return false;

        const { $from } = selection;
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");

        // Find last "/" in the text
        const slashIndex = textBefore.lastIndexOf("/");
        if (slashIndex === -1) return false;

        // Check that "/" is at start of line or after whitespace
        if (slashIndex > 0) {
          const charBefore = textBefore[slashIndex - 1];
          if (charBefore && !/\s/.test(charBefore)) return false;
        }

        // Extract filter text after "/"
        const filterText = textBefore.slice(slashIndex + 1);

        // Don't show if there's a space in the filter (user moved on)
        if (filterText.includes(" ")) return false;

        // Update filter and render
        this.filter = filterText.toLowerCase();
        this.selectedIndex = 0;
        this.render();

        return true;
      },
      offset: 8,
    });

    this.slashProvider.onShow = () => {
      this.isVisible = true;
      this.container.style.display = "block";
    };

    this.slashProvider.onHide = () => {
      this.isVisible = false;
      this.container.style.display = "none";
    };

    // Intercept keyboard events from the editor
    this.editorView.dom.addEventListener("keydown", this.handleEditorKeyDown, true);

    this.update(view);
  }

  update = (view: EditorView) => {
    this.editorView = view;
    this.slashProvider.update(view);
  };

  destroy = () => {
    this.editorView.dom.removeEventListener("keydown", this.handleEditorKeyDown, true);
    this.slashProvider.destroy();
    this.container.remove();
  };

  private handleEditorKeyDown = (e: KeyboardEvent) => {
    if (!this.isVisible) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = Math.min(
          this.selectedIndex + 1,
          this.filteredItems.length - 1
        );
        this.render();
        break;
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.render();
        break;
      case "Tab":
      case "Enter":
        e.preventDefault();
        e.stopPropagation();
        this.selectItem(this.selectedIndex);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        this.slashProvider.hide();
        // Delete the slash text on escape
        this.deleteSlashText();
        break;
    }
  };

  private deleteSlashText() {
    const { state } = this.editorView;
    const { $from } = state.selection;
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
    const slashIndex = textBefore.lastIndexOf("/");

    if (slashIndex >= 0) {
      const start = $from.start() + slashIndex;
      const end = $from.pos;
      const tr = state.tr.delete(start, end);
      this.editorView.dispatch(tr);
    }
  }

  private selectItem(index: number) {
    const item = this.filteredItems[index];
    if (!item) return;

    // Delete the slash text first
    this.deleteSlashText();

    // Hide menu
    this.slashProvider.hide();

    // Focus editor and execute the action
    this.editorView.focus();
    item.action(this.ctx);
  }

  private render() {
    // Filter items based on input
    this.filteredItems = menuItems.filter(
      (item) =>
        item.label.toLowerCase().includes(this.filter) ||
        item.keywords?.some((k) => k.includes(this.filter))
    );

    // Group items
    const groups = new Map<string, SlashMenuItem[]>();
    for (const item of this.filteredItems) {
      const group = item.group || "Other";
      if (!groups.has(group)) {
        groups.set(group, []);
      }
      groups.get(group)!.push(item);
    }

    // Build HTML
    let html = "";
    let globalIndex = 0;

    for (const [groupName, items] of groups) {
      html += `<div class="slash-menu-group">`;
      html += `<div class="slash-menu-group-label">${groupName}</div>`;

      for (const item of items) {
        const isSelected = globalIndex === this.selectedIndex;
        html += `
          <div class="slash-menu-item${isSelected ? " selected" : ""}" data-index="${globalIndex}">
            <span class="slash-menu-item-icon">${item.icon}</span>
            <span class="slash-menu-item-label">${item.label}</span>
          </div>
        `;
        globalIndex++;
      }

      html += `</div>`;
    }

    if (this.filteredItems.length === 0) {
      html = `<div class="slash-menu-empty">No results</div>`;
    }

    this.container.innerHTML = html;

    // Add click handlers
    const itemElements = this.container.querySelectorAll(".slash-menu-item");
    itemElements.forEach((el) => {
      el.addEventListener("mousedown", (e) => {
        e.preventDefault(); // Prevent blur
        const index = parseInt(el.getAttribute("data-index") || "0", 10);
        this.selectItem(index);
      });
      el.addEventListener("mouseenter", () => {
        const index = parseInt(el.getAttribute("data-index") || "0", 10);
        this.selectedIndex = index;
        this.render();
      });
    });

    // Scroll selected item into view
    const selectedEl = this.container.querySelector(".slash-menu-item.selected");
    selectedEl?.scrollIntoView({ block: "nearest" });
  }
}

export { menuItems, type SlashMenuItem } from "./menuItems";
