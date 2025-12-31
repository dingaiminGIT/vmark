/**
 * Trigger Menu View
 *
 * Configurable menu view with nested submenu support.
 */

import { SlashProvider } from "@milkdown/kit/plugin/slash";
import type { Ctx } from "@milkdown/kit/ctx";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { PluginView } from "@milkdown/kit/prose/state";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { TriggerMenuConfig, MenuLevel } from "./types";
import { isInCodeBlock, filterItems, groupItems } from "./utils";
import { buildMenuItem, buildGroup, buildEmptyState } from "./dom-builders";

/**
 * Trigger menu view - manages the popup UI with nested submenu support.
 */
export class TriggerMenuView implements PluginView {
  private container: HTMLElement;
  private slashProvider: SlashProvider;
  private filter = "";
  private isVisible = false;
  private editorView: EditorView;
  private menuStack: MenuLevel[] = [];
  private mouseActivated = false;

  constructor(
    private ctx: Ctx,
    view: EditorView,
    private config: TriggerMenuConfig
  ) {
    this.editorView = view;
    this.container = document.createElement("div");
    this.container.className = `trigger-menu ${config.className || ""}`.trim();
    this.container.style.display = "none";

    this.slashProvider = new SlashProvider({
      content: this.container,
      debounce: 50,
      shouldShow: (view) => this.shouldShowMenu(view),
      offset: 8,
    });

    this.slashProvider.onShow = () => {
      this.isVisible = true;
      this.mouseActivated = false;
      this.container.style.display = "block";
    };

    this.container.addEventListener("mousemove", this.handleMouseMove);

    this.slashProvider.onHide = () => {
      this.isVisible = false;
      this.container.style.display = "none";
      this.closeAllSubmenus();
    };

    this.editorView.dom.addEventListener("keydown", this.handleEditorKeyDown, true);
    this.update(view);
  }

  private shouldShowMenu(view: EditorView): boolean {
    if (isInCodeBlock(view)) return false;

    const { selection } = view.state;
    if (!(selection instanceof TextSelection)) return false;

    const { $from } = selection;
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
    const triggerIndex = textBefore.lastIndexOf(this.config.trigger);
    if (triggerIndex === -1) return false;

    if (triggerIndex > 0) {
      const charBefore = textBefore[triggerIndex - 1];
      if (charBefore && !/\s/.test(charBefore)) return false;
    }

    const filterText = textBefore.slice(triggerIndex + this.config.trigger.length);
    if (filterText.includes(" ")) return false;

    const newFilter = filterText.toLowerCase();
    const filterChanged = this.filter !== newFilter;
    const needsInitialBuild = this.menuStack.length === 0;
    this.filter = newFilter;

    if (filterChanged || needsInitialBuild) {
      this.rebuildMenu();
    }

    return true;
  }

  update = (view: EditorView) => {
    this.editorView = view;
    this.slashProvider.update(view);
  };

  destroy = () => {
    this.editorView.dom.removeEventListener("keydown", this.handleEditorKeyDown, true);
    this.container.removeEventListener("mousemove", this.handleMouseMove);
    this.slashProvider.destroy();
    this.container.remove();
  };

  private handleMouseMove = () => {
    this.mouseActivated = true;
  };

  private handleEditorKeyDown = (e: KeyboardEvent) => {
    if (!this.isVisible) return;

    const currentLevel = this.getCurrentLevel();
    if (!currentLevel) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        this.navigateVertical(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        this.navigateVertical(-1);
        break;
      case "ArrowRight":
        e.preventDefault();
        e.stopPropagation();
        this.openSubmenu();
        break;
      case "ArrowLeft":
        e.preventDefault();
        e.stopPropagation();
        this.closeSubmenu();
        break;
      case "Tab":
      case "Enter":
        e.preventDefault();
        e.stopPropagation();
        this.selectCurrentItem();
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        if (this.menuStack.length > 1) {
          this.closeSubmenu();
        } else {
          this.slashProvider.hide();
          this.deleteTriggerText();
        }
        break;
    }
  };

  private getCurrentLevel(): MenuLevel | null {
    return this.menuStack[this.menuStack.length - 1] || null;
  }

  private navigateVertical(delta: number) {
    const level = this.getCurrentLevel();
    if (!level) return;

    const newIndex = Math.max(0, Math.min(level.items.length - 1, level.selectedIndex + delta));
    if (newIndex !== level.selectedIndex) {
      this.updateLevelSelection(level, newIndex);
    }
  }

  private updateLevelSelection(level: MenuLevel, newIndex: number) {
    const oldEl = level.elements[level.selectedIndex];
    if (oldEl) oldEl.classList.remove("selected");

    level.selectedIndex = newIndex;

    const newEl = level.elements[newIndex];
    if (newEl) {
      newEl.classList.add("selected");
      newEl.scrollIntoView({ block: "nearest" });
    }

    if (this.menuStack.length > 1 && level === this.menuStack[0]) {
      this.closeAllSubmenus();
      this.menuStack = [this.menuStack[0]];
    }
  }

  private openSubmenu() {
    const level = this.getCurrentLevel();
    if (!level) return;

    const item = level.items[level.selectedIndex];
    if (!item?.children || item.children.length === 0) return;

    const itemEl = level.elements[level.selectedIndex];
    if (!itemEl) return;

    const submenu = document.createElement("div");
    submenu.className = "trigger-menu-submenu";

    const rect = itemEl.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    submenu.style.left = `${rect.right - containerRect.left}px`;
    submenu.style.top = `${rect.top - containerRect.top}px`;

    const elements: HTMLElement[] = [];
    item.children.forEach((child, index) => {
      const hasChildren = !!(child.children && child.children.length > 0);
      const childEl = buildMenuItem(child, index, index === 0, hasChildren);

      childEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const idx = parseInt(childEl.dataset.index || "0", 10);
        this.updateLevelSelection(this.getCurrentLevel()!, idx);
        this.selectCurrentItem();
      });

      childEl.addEventListener("mouseenter", () => {
        if (!this.mouseActivated) return;
        const idx = parseInt(childEl.dataset.index || "0", 10);
        this.updateLevelSelection(this.getCurrentLevel()!, idx);
      });

      elements.push(childEl);
      submenu.appendChild(childEl);
    });

    this.container.appendChild(submenu);
    this.menuStack.push({ items: item.children, selectedIndex: 0, elements, container: submenu });
  }

  private closeSubmenu() {
    if (this.menuStack.length <= 1) return;
    const level = this.menuStack.pop();
    if (level?.container) level.container.remove();
  }

  private closeAllSubmenus() {
    while (this.menuStack.length > 1) {
      const level = this.menuStack.pop();
      if (level?.container) level.container.remove();
    }
  }

  private selectCurrentItem() {
    const level = this.getCurrentLevel();
    if (!level) return;

    const item = level.items[level.selectedIndex];
    if (!item) return;

    if (item.children && item.children.length > 0) {
      this.openSubmenu();
      return;
    }

    if (!item.action) return;

    const selection = this.getSelection();
    this.deleteTriggerText();
    this.slashProvider.hide();
    this.editorView.focus();
    item.action(this.ctx, selection);
  }

  private deleteTriggerText() {
    const { state } = this.editorView;
    const { $from } = state.selection;
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
    const triggerIndex = textBefore.lastIndexOf(this.config.trigger);

    if (triggerIndex >= 0) {
      const start = $from.start() + triggerIndex;
      const end = $from.pos;
      const tr = state.tr.delete(start, end);
      this.editorView.dispatch(tr);
    }
  }

  private getSelection(): string {
    if (!this.config.selectionAware) return "";
    const { state } = this.editorView;
    const { from, to } = state.selection;
    if (from === to) return "";
    return state.doc.textBetween(from, to);
  }

  private rebuildMenu() {
    this.closeAllSubmenus();
    this.menuStack = [];

    const filteredItems = filterItems(this.config.items, this.filter);
    this.container.replaceChildren();

    if (filteredItems.length === 0) {
      this.container.appendChild(buildEmptyState());
      return;
    }

    const rootContainer = document.createElement("div");
    rootContainer.className = "trigger-menu-root";

    const elements: HTMLElement[] = [];
    let globalIndex = 0;

    if (this.filter) {
      for (const item of filteredItems) {
        const hasChildren = !!(item.children && item.children.length > 0);
        const isSelected = globalIndex === 0;
        const itemEl = buildMenuItem(item, globalIndex, isSelected, hasChildren);
        this.addItemEventListeners(itemEl, globalIndex);
        elements.push(itemEl);
        rootContainer.appendChild(itemEl);
        globalIndex++;
      }
    } else {
      const groups = groupItems(filteredItems);
      for (const [groupName, items] of groups) {
        const groupDiv = buildGroup(groupName);
        for (const item of items) {
          const hasChildren = !!(item.children && item.children.length > 0);
          const isSelected = globalIndex === 0;
          const itemEl = buildMenuItem(item, globalIndex, isSelected, hasChildren);
          this.addItemEventListeners(itemEl, globalIndex);
          elements.push(itemEl);
          groupDiv.appendChild(itemEl);
          globalIndex++;
        }
        rootContainer.appendChild(groupDiv);
      }
    }

    this.container.appendChild(rootContainer);
    this.menuStack.push({ items: filteredItems, selectedIndex: 0, elements, container: rootContainer });
    elements[0]?.scrollIntoView({ block: "nearest" });
  }

  private addItemEventListeners(itemEl: HTMLElement, index: number) {
    itemEl.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const level = this.getCurrentLevel();
      if (level) {
        this.updateLevelSelection(level, index);
        this.selectCurrentItem();
      }
    });

    itemEl.addEventListener("mouseenter", () => {
      if (!this.mouseActivated) return;

      const level = this.menuStack[0];
      if (level) {
        if (level.selectedIndex !== index) {
          this.closeAllSubmenus();
          this.menuStack = [this.menuStack[0]];
        }
        this.updateLevelSelection(level, index);

        const item = level.items[index];
        if (item?.children && item.children.length > 0) {
          setTimeout(() => {
            if (level.selectedIndex === index && this.menuStack.length === 1) {
              this.openSubmenu();
            }
          }, 200);
        }
      }
    });
  }
}

// Re-export utilities for tests
export { filterItems, groupItems } from "./utils";
