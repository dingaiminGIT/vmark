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
import type { TriggerMenuConfig, TriggerMenuItem } from "./types";

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
 * Flatten nested items for filtering - returns all leaf items with their full path.
 */
function flattenItems(items: TriggerMenuItem[]): TriggerMenuItem[] {
  const result: TriggerMenuItem[] = [];
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      // Add flattened children
      result.push(...flattenItems(item.children));
    } else if (item.action) {
      // Only add leaf items with actions
      result.push(item);
    }
  }
  return result;
}

/**
 * Filter items based on search text - searches through nested items.
 */
export function filterItems(
  items: TriggerMenuItem[],
  filter: string
): TriggerMenuItem[] {
  if (!filter) {
    // No filter - return top-level items (don't flatten)
    return items;
  }

  // When filtering, flatten and search all items
  const allItems = flattenItems(items);
  const lowerFilter = filter.toLowerCase();
  return allItems.filter(
    (item) =>
      item.label.toLowerCase().includes(lowerFilter) ||
      item.keywords?.some((k) => k.includes(lowerFilter))
  );
}

/**
 * Group items by their group property.
 */
export function groupItems(
  items: TriggerMenuItem[]
): Map<string, TriggerMenuItem[]> {
  const groups = new Map<string, TriggerMenuItem[]>();
  for (const item of items) {
    const group = item.group || "Other";
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(item);
  }
  return groups;
}

/**
 * Chevron right icon for submenu indicators.
 */
const chevronRightIcon = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="m9 18 6-6-6-6"/></svg>`;

/**
 * Build a menu item element using DOM APIs (XSS-safe).
 */
function buildMenuItem(
  item: TriggerMenuItem,
  index: number,
  isSelected: boolean,
  hasChildren: boolean
): HTMLElement {
  const div = document.createElement("div");
  div.className = `trigger-menu-item${isSelected ? " selected" : ""}${hasChildren ? " has-children" : ""}`;
  div.dataset.index = String(index);

  const iconSpan = document.createElement("span");
  iconSpan.className = "trigger-menu-item-icon";
  // SVG icons are static/trusted from our codebase
  iconSpan.innerHTML = item.icon;

  const labelSpan = document.createElement("span");
  labelSpan.className = "trigger-menu-item-label";
  // Use textContent for safety - prevents XSS
  labelSpan.textContent = item.label;

  div.appendChild(iconSpan);
  div.appendChild(labelSpan);

  // Add chevron for items with children
  if (hasChildren) {
    const chevronSpan = document.createElement("span");
    chevronSpan.className = "trigger-menu-item-chevron";
    chevronSpan.innerHTML = chevronRightIcon;
    div.appendChild(chevronSpan);
  }

  return div;
}

/**
 * Build a group container with label.
 */
function buildGroup(groupName: string): HTMLElement {
  const groupDiv = document.createElement("div");
  groupDiv.className = "trigger-menu-group";

  const labelDiv = document.createElement("div");
  labelDiv.className = "trigger-menu-group-label";
  labelDiv.textContent = groupName;

  groupDiv.appendChild(labelDiv);
  return groupDiv;
}

/**
 * Build empty state element.
 */
function buildEmptyState(): HTMLElement {
  const div = document.createElement("div");
  div.className = "trigger-menu-empty";
  div.textContent = "No results";
  return div;
}

/**
 * Navigation state for nested menus.
 */
interface MenuLevel {
  items: TriggerMenuItem[];
  selectedIndex: number;
  elements: HTMLElement[];
  container: HTMLElement;
}

/**
 * Trigger menu view - manages the popup UI with nested submenu support.
 */
export class TriggerMenuView implements PluginView {
  private container: HTMLElement;
  private slashProvider: SlashProvider;
  private filter = "";
  private isVisible = false;
  private editorView: EditorView;

  // Navigation stack for nested menus
  private menuStack: MenuLevel[] = [];

  // Mouse interaction guard - ignore mouse events until actual movement
  private mouseActivated = false;

  constructor(
    private ctx: Ctx,
    view: EditorView,
    private config: TriggerMenuConfig
  ) {
    this.editorView = view;

    // Create container element
    this.container = document.createElement("div");
    this.container.className = `trigger-menu ${config.className || ""}`.trim();
    this.container.style.display = "none";

    // Initialize slash provider
    this.slashProvider = new SlashProvider({
      content: this.container,
      debounce: 50,
      shouldShow: (view) => this.shouldShowMenu(view),
      offset: 8,
    });

    this.slashProvider.onShow = () => {
      this.isVisible = true;
      this.mouseActivated = false; // Reset - ignore mouse until movement
      this.container.style.display = "block";
    };

    // Activate mouse interaction only after actual mouse movement
    this.container.addEventListener("mousemove", this.handleMouseMove);

    this.slashProvider.onHide = () => {
      this.isVisible = false;
      this.container.style.display = "none";
      this.closeAllSubmenus();
    };

    // Intercept keyboard events from the editor
    this.editorView.dom.addEventListener(
      "keydown",
      this.handleEditorKeyDown,
      true
    );

    this.update(view);
  }

  private shouldShowMenu(view: EditorView): boolean {
    // Don't show in code blocks
    if (isInCodeBlock(view)) return false;

    // Get the text content before cursor
    const { selection } = view.state;
    if (!(selection instanceof TextSelection)) return false;

    const { $from } = selection;
    const textBefore = $from.parent.textBetween(
      0,
      $from.parentOffset,
      undefined,
      "\ufffc"
    );

    // Find trigger character in the text
    const triggerIndex = textBefore.lastIndexOf(this.config.trigger);
    if (triggerIndex === -1) return false;

    // Check that trigger is at start of line or after whitespace
    if (triggerIndex > 0) {
      const charBefore = textBefore[triggerIndex - 1];
      if (charBefore && !/\s/.test(charBefore)) return false;
    }

    // Extract filter text after trigger
    const filterText = textBefore.slice(
      triggerIndex + this.config.trigger.length
    );

    // Don't show if there's a space in the filter (user moved on)
    if (filterText.includes(" ")) return false;

    // Check if filter changed or if menu needs initial build
    const newFilter = filterText.toLowerCase();
    const filterChanged = this.filter !== newFilter;
    const needsInitialBuild = this.menuStack.length === 0;
    this.filter = newFilter;

    // Rebuild DOM if filter changed or first time showing
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
    this.editorView.dom.removeEventListener(
      "keydown",
      this.handleEditorKeyDown,
      true
    );
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

    const newIndex = Math.max(
      0,
      Math.min(level.items.length - 1, level.selectedIndex + delta)
    );

    if (newIndex !== level.selectedIndex) {
      this.updateLevelSelection(level, newIndex);
    }
  }

  private updateLevelSelection(level: MenuLevel, newIndex: number) {
    // Remove selection from old item
    const oldEl = level.elements[level.selectedIndex];
    if (oldEl) {
      oldEl.classList.remove("selected");
    }

    // Update selection
    level.selectedIndex = newIndex;

    // Add selection to new item
    const newEl = level.elements[newIndex];
    if (newEl) {
      newEl.classList.add("selected");
      newEl.scrollIntoView({ block: "nearest" });
    }

    // If this is the root level and we change selection, close any open submenu
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

    // Get position of the selected item for submenu placement
    const itemEl = level.elements[level.selectedIndex];
    if (!itemEl) return;

    // Create submenu container
    const submenu = document.createElement("div");
    submenu.className = "trigger-menu-submenu";

    // Position submenu relative to parent item
    const rect = itemEl.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    submenu.style.left = `${rect.right - containerRect.left}px`;
    submenu.style.top = `${rect.top - containerRect.top}px`;

    // Build submenu items
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

    // Add submenu to container
    this.container.appendChild(submenu);

    // Push new level onto stack
    this.menuStack.push({
      items: item.children,
      selectedIndex: 0,
      elements,
      container: submenu,
    });
  }

  private closeSubmenu() {
    if (this.menuStack.length <= 1) return;

    // Remove the current submenu
    const level = this.menuStack.pop();
    if (level?.container) {
      level.container.remove();
    }
  }

  private closeAllSubmenus() {
    while (this.menuStack.length > 1) {
      const level = this.menuStack.pop();
      if (level?.container) {
        level.container.remove();
      }
    }
  }

  private selectCurrentItem() {
    const level = this.getCurrentLevel();
    if (!level) return;

    const item = level.items[level.selectedIndex];
    if (!item) return;

    // If item has children, open submenu instead
    if (item.children && item.children.length > 0) {
      this.openSubmenu();
      return;
    }

    // Leaf item - execute action
    if (!item.action) return;

    // Get selection before deleting trigger text
    const selection = this.getSelection();

    // Delete the trigger text first
    this.deleteTriggerText();

    // Hide menu
    this.slashProvider.hide();

    // Focus editor and execute the action
    this.editorView.focus();
    item.action(this.ctx, selection);
  }

  private deleteTriggerText() {
    const { state } = this.editorView;
    const { $from } = state.selection;
    const textBefore = $from.parent.textBetween(
      0,
      $from.parentOffset,
      undefined,
      "\ufffc"
    );
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

  /**
   * Full DOM rebuild - only called when filter changes.
   */
  private rebuildMenu() {
    // Close any open submenus
    this.closeAllSubmenus();
    this.menuStack = [];

    // Filter items based on input
    const filteredItems = filterItems(this.config.items, this.filter);

    // Clear container
    this.container.replaceChildren();

    if (filteredItems.length === 0) {
      this.container.appendChild(buildEmptyState());
      return;
    }

    // Create root level container
    const rootContainer = document.createElement("div");
    rootContainer.className = "trigger-menu-root";

    // When filtered, show flat list without groups
    // When not filtered, show grouped hierarchy
    const elements: HTMLElement[] = [];
    let globalIndex = 0;

    if (this.filter) {
      // Filtered mode - flat list of matching items
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
      // Normal mode - grouped hierarchy
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

    // Initialize root level
    this.menuStack.push({
      items: filteredItems,
      selectedIndex: 0,
      elements,
      container: rootContainer,
    });

    // Scroll selected item into view
    const selectedEl = elements[0];
    selectedEl?.scrollIntoView({ block: "nearest" });
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
      // Ignore until mouse has actually moved (prevents cursor position on show)
      if (!this.mouseActivated) return;

      const level = this.menuStack[0]; // Always update root level on hover
      if (level) {
        // Close submenus when hovering different root items
        if (level.selectedIndex !== index) {
          this.closeAllSubmenus();
          this.menuStack = [this.menuStack[0]];
        }
        this.updateLevelSelection(level, index);

        // Auto-open submenu on hover after a short delay
        const item = level.items[index];
        if (item?.children && item.children.length > 0) {
          setTimeout(() => {
            // Only open if still on same item
            if (level.selectedIndex === index && this.menuStack.length === 1) {
              this.openSubmenu();
            }
          }, 200);
        }
      }
    });
  }
}
