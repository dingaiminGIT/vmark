/**
 * Trigger Menu Types
 *
 * Shared types for the trigger menu factory system.
 */

import type { Ctx } from "@milkdown/kit/ctx";

/**
 * A menu item that can be selected from the trigger menu.
 * Items can either have an action (leaf items) or children (parent items).
 */
export interface TriggerMenuItem {
  label: string;
  icon: string; // SVG string or emoji
  group?: string;
  keywords?: string[];
  /** Action to execute when selected (leaf items only) */
  action?: (ctx: Ctx, selection?: string) => void | Promise<void>;
  /** Child items for nested submenus (parent items only) */
  children?: TriggerMenuItem[];
}

/**
 * Configuration for creating a trigger menu.
 */
export interface TriggerMenuConfig {
  /** Unique ID for the plugin instance */
  id: string;
  /** Trigger character (e.g., "/", ":", "~", ">") */
  trigger: string;
  /** Menu items to display */
  items: TriggerMenuItem[];
  /** Placeholder text for freeform input mode */
  placeholder?: string;
  /** Additional CSS class for the menu container */
  className?: string;
  /** Enable freeform text input mode (for prompts) */
  freeformMode?: boolean;
  /** Pass current selection to action handlers */
  selectionAware?: boolean;
  /** Callback for freeform text submission */
  onFreeformSubmit?: (text: string, selection: string, ctx: Ctx) => void | Promise<void>;
}

/**
 * Navigation state for nested menus.
 */
export interface MenuLevel {
  items: TriggerMenuItem[];
  selectedIndex: number;
  elements: HTMLElement[];
  container: HTMLElement;
}
