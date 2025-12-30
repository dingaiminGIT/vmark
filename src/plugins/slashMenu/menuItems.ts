/**
 * Slash Menu Items
 *
 * Defines the items available in the slash command menu.
 * Uses inline SVG icons matching Lucide design (24x24 viewBox, stroke-based).
 *
 * Note: Slash text deletion is handled by the SlashMenuView before action is called.
 */

import type { Ctx } from "@milkdown/kit/ctx";
import { editorViewCtx } from "@milkdown/kit/core";
import { callCommand } from "@milkdown/kit/utils";
import {
  wrapInHeadingCommand,
  wrapInBlockquoteCommand,
  insertHrCommand,
  createCodeBlockCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
} from "@milkdown/kit/preset/commonmark";
import {
  insertTableCommand,
  toggleStrikethroughCommand,
} from "@milkdown/kit/preset/gfm";

export interface SlashMenuItem {
  label: string;
  icon: string; // SVG string
  group: string;
  keywords?: string[];
  action: (ctx: Ctx) => void;
}

/**
 * Lucide-style SVG icons (24x24 viewBox, stroke-based)
 */
const icons = {
  // Pilcrow / Paragraph
  paragraph: `<svg viewBox="0 0 24 24"><path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 1 0 0 9H13"/></svg>`,
  // Heading 1
  heading1: `<svg viewBox="0 0 24 24"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="m17 12 3-2v8"/></svg>`,
  // Heading 2
  heading2: `<svg viewBox="0 0 24 24"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>`,
  // Heading 3
  heading3: `<svg viewBox="0 0 24 24"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/></svg>`,
  // Quote / TextQuote
  quote: `<svg viewBox="0 0 24 24"><path d="M17 6H3"/><path d="M21 12H8"/><path d="M21 18H8"/><path d="M3 12v6"/></svg>`,
  // Minus / Divider
  minus: `<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>`,
  // List (bullet)
  list: `<svg viewBox="0 0 24 24"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`,
  // ListOrdered
  listOrdered: `<svg viewBox="0 0 24 24"><line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>`,
  // ListTodo / CheckSquare
  listTodo: `<svg viewBox="0 0 24 24"><rect width="6" height="6" x="3" y="5" rx="1"/><path d="m3 17 2 2 4-4"/><line x1="13" x2="21" y1="6" y2="6"/><line x1="13" x2="21" y1="12" y2="12"/><line x1="13" x2="21" y1="18" y2="18"/></svg>`,
  // Code
  code: `<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  // Table
  table: `<svg viewBox="0 0 24 24"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>`,
  // Sigma / Math
  sigma: `<svg viewBox="0 0 24 24"><path d="M18 7V4H6l6 8-6 8h12v-3"/></svg>`,
  // GitBranch / Diagram
  diagram: `<svg viewBox="0 0 24 24"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`,
  // Strikethrough
  strikethrough: `<svg viewBox="0 0 24 24"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/></svg>`,
};

/**
 * Menu items grouped by category.
 */
export const menuItems: SlashMenuItem[] = [
  // Text group
  {
    label: "Paragraph",
    icon: icons.paragraph,
    group: "Text",
    keywords: ["text", "normal", "plain"],
    action: () => {
      // Slash text already deleted, paragraph is default - nothing to do
    },
  },
  {
    label: "Heading 1",
    icon: icons.heading1,
    group: "Text",
    keywords: ["h1", "title", "heading"],
    action: (ctx) => {
      callCommand(wrapInHeadingCommand.key, 1)(ctx);
    },
  },
  {
    label: "Heading 2",
    icon: icons.heading2,
    group: "Text",
    keywords: ["h2", "subtitle", "heading"],
    action: (ctx) => {
      callCommand(wrapInHeadingCommand.key, 2)(ctx);
    },
  },
  {
    label: "Heading 3",
    icon: icons.heading3,
    group: "Text",
    keywords: ["h3", "heading"],
    action: (ctx) => {
      callCommand(wrapInHeadingCommand.key, 3)(ctx);
    },
  },
  {
    label: "Quote",
    icon: icons.quote,
    group: "Text",
    keywords: ["blockquote", "citation"],
    action: (ctx) => {
      callCommand(wrapInBlockquoteCommand.key)(ctx);
    },
  },
  {
    label: "Divider",
    icon: icons.minus,
    group: "Text",
    keywords: ["hr", "horizontal", "line", "separator"],
    action: (ctx) => {
      callCommand(insertHrCommand.key)(ctx);
    },
  },

  // List group
  {
    label: "Bullet List",
    icon: icons.list,
    group: "List",
    keywords: ["ul", "unordered", "bullets"],
    action: (ctx) => {
      callCommand(wrapInBulletListCommand.key)(ctx);
    },
  },
  {
    label: "Numbered List",
    icon: icons.listOrdered,
    group: "List",
    keywords: ["ol", "ordered", "numbers"],
    action: (ctx) => {
      callCommand(wrapInOrderedListCommand.key)(ctx);
    },
  },
  {
    label: "Task List",
    icon: icons.listTodo,
    group: "List",
    keywords: ["todo", "checkbox", "checklist"],
    action: (ctx) => {
      const view = ctx.get(editorViewCtx);
      const { state } = view;
      const tr = state.tr.insertText("- [ ] ");
      view.dispatch(tr);
    },
  },

  // Advanced group
  {
    label: "Code Block",
    icon: icons.code,
    group: "Advanced",
    keywords: ["pre", "code", "syntax", "programming"],
    action: (ctx) => {
      callCommand(createCodeBlockCommand.key)(ctx);
    },
  },
  {
    label: "Table",
    icon: icons.table,
    group: "Advanced",
    keywords: ["grid", "spreadsheet"],
    action: (ctx) => {
      callCommand(insertTableCommand.key)(ctx);
    },
  },
  {
    label: "Math Block",
    icon: icons.sigma,
    group: "Advanced",
    keywords: ["latex", "equation", "formula", "katex"],
    action: (ctx) => {
      callCommand(createCodeBlockCommand.key)(ctx);
    },
  },
  {
    label: "Mermaid Diagram",
    icon: icons.diagram,
    group: "Advanced",
    keywords: ["diagram", "flowchart", "chart", "graph"],
    action: (ctx) => {
      callCommand(createCodeBlockCommand.key)(ctx);
    },
  },

  // Format group (inline)
  {
    label: "Strikethrough",
    icon: icons.strikethrough,
    group: "Format",
    keywords: ["strike", "delete", "cross"],
    action: (ctx) => {
      callCommand(toggleStrikethroughCommand.key)(ctx);
    },
  },
];
