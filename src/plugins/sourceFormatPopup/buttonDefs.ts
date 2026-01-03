/**
 * Button Definitions for Source Format Popup
 *
 * Centralized button configuration for all popup modes.
 */

import { icons, createIcon } from "@/utils/icons";
import type { FormatType } from "./formatActions";
import type { TableAlignment } from "./tableDetection";

export interface FormatButton {
  type: FormatType;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
}

export interface TableButtonDef {
  id: string;
  icon: React.ReactNode;
  label: string;
  action:
    | "rowAbove"
    | "rowBelow"
    | "colLeft"
    | "colRight"
    | "deleteRow"
    | "deleteCol"
    | "deleteTable"
    | "separator";
  variant?: "danger";
}

export interface AlignButtonDef {
  id: string;
  icon: React.ReactNode;
  label: string;
  alignment: TableAlignment;
}

export interface HeadingButtonDef {
  level: number;
  icon: React.ReactNode;
  label: string;
}

// Format button groups: headings | bold italic strike highlight | link image | sup sub code
export const TEXT_FORMAT_BUTTONS: FormatButton[] = [
  { type: "bold", icon: createIcon(icons.bold), label: "Bold", shortcut: "⌘B" },
  {
    type: "italic",
    icon: createIcon(icons.italic),
    label: "Italic",
    shortcut: "⌘I",
  },
  {
    type: "strikethrough",
    icon: createIcon(icons.strikethrough),
    label: "Strikethrough",
    shortcut: "⌘⇧X",
  },
  {
    type: "highlight",
    icon: createIcon(icons.highlight),
    label: "Highlight",
    shortcut: "⌘⇧H",
  },
];

export const LINK_BUTTONS: FormatButton[] = [
  { type: "link", icon: createIcon(icons.link), label: "Link", shortcut: "⌘K" },
  {
    type: "image",
    icon: createIcon(icons.image),
    label: "Image",
    shortcut: "⌘⇧I",
  },
];

export const CODE_BUTTONS: FormatButton[] = [
  {
    type: "superscript",
    icon: createIcon(icons.superscript),
    label: "Superscript",
    shortcut: "⌘⇧.",
  },
  {
    type: "subscript",
    icon: createIcon(icons.subscript),
    label: "Subscript",
    shortcut: "⌘.",
  },
  {
    type: "code",
    icon: createIcon(icons.inlineCode),
    label: "Code",
    shortcut: "⌘`",
  },
];

// Combined for active format detection
export const ALL_FORMAT_BUTTONS = [
  ...TEXT_FORMAT_BUTTONS,
  ...LINK_BUTTONS,
  ...CODE_BUTTONS,
];

export const TABLE_BUTTONS: TableButtonDef[] = [
  {
    id: "rowAbove",
    icon: createIcon(icons.rowAbove),
    label: "Insert row above",
    action: "rowAbove",
  },
  {
    id: "rowBelow",
    icon: createIcon(icons.rowBelow),
    label: "Insert row below",
    action: "rowBelow",
  },
  {
    id: "colLeft",
    icon: createIcon(icons.colLeft),
    label: "Insert column left",
    action: "colLeft",
  },
  {
    id: "colRight",
    icon: createIcon(icons.colRight),
    label: "Insert column right",
    action: "colRight",
  },
  { id: "sep1", icon: null, label: "", action: "separator" },
  {
    id: "deleteRow",
    icon: createIcon(icons.deleteRow),
    label: "Delete row",
    action: "deleteRow",
  },
  {
    id: "deleteCol",
    icon: createIcon(icons.deleteCol),
    label: "Delete column",
    action: "deleteCol",
  },
  {
    id: "deleteTable",
    icon: createIcon(icons.deleteTable),
    label: "Delete table",
    action: "deleteTable",
  },
];

export const ALIGN_BUTTONS: AlignButtonDef[] = [
  {
    id: "alignLeft",
    icon: createIcon(icons.alignLeft),
    label: "Align column left",
    alignment: "left",
  },
  {
    id: "alignCenter",
    icon: createIcon(icons.alignCenter),
    label: "Align column center",
    alignment: "center",
  },
  {
    id: "alignRight",
    icon: createIcon(icons.alignRight),
    label: "Align column right",
    alignment: "right",
  },
];

export const ALIGN_ALL_BUTTONS: AlignButtonDef[] = [
  {
    id: "alignAllLeft",
    icon: createIcon(icons.alignAllLeft),
    label: "Align all left",
    alignment: "left",
  },
  {
    id: "alignAllCenter",
    icon: createIcon(icons.alignAllCenter),
    label: "Align all center",
    alignment: "center",
  },
  {
    id: "alignAllRight",
    icon: createIcon(icons.alignAllRight),
    label: "Align all right",
    alignment: "right",
  },
];

export const HEADING_BUTTONS: HeadingButtonDef[] = [
  { level: 1, icon: createIcon(icons.heading1), label: "Heading 1" },
  { level: 2, icon: createIcon(icons.heading2), label: "Heading 2" },
  { level: 3, icon: createIcon(icons.heading3), label: "Heading 3" },
  { level: 4, icon: createIcon(icons.heading4), label: "Heading 4" },
  { level: 5, icon: createIcon(icons.heading5), label: "Heading 5" },
  { level: 6, icon: createIcon(icons.heading6), label: "Heading 6" },
  { level: 0, icon: createIcon(icons.paragraph), label: "Paragraph" },
];
