import type { Editor as TiptapEditor } from "@tiptap/core";

export type SlashMenuActionContext = {
  editor: TiptapEditor;
  query: string;
  range: { from: number; to: number };
};

export interface SlashMenuItem {
  label: string;
  icon: string;
  group?: string;
  keywords?: string[];
  action?: (context: SlashMenuActionContext) => void | boolean | Promise<void>;
  children?: SlashMenuItem[];
}

export function parseTrigger(
  textBeforeCursor: string,
  trigger: string
): { query: string; triggerIndex: number } | null {
  const triggerIndex = textBeforeCursor.lastIndexOf(trigger);
  if (triggerIndex === -1) return null;

  const query = textBeforeCursor.slice(triggerIndex + trigger.length);
  if (/\s/.test(query)) return null;

  if (shouldIgnoreTrigger(textBeforeCursor, trigger, triggerIndex)) return null;

  return { query, triggerIndex };
}

function shouldIgnoreTrigger(
  textBeforeCursor: string,
  trigger: string,
  triggerIndex: number
): boolean {
  const charBefore = triggerIndex > 0 ? textBeforeCursor[triggerIndex - 1] : "";

  switch (trigger) {
    case "// ": {
      if (charBefore === "/" || charBefore === ":") return true; // Avoid "/// " and "http:// "
      return false;
    }
    case ";; ": {
      if (charBefore === ";") return true; // Avoid ";;; "
      return false;
    }
    case ",, ": {
      if (charBefore === ",") return true; // Avoid ",,, "
      return false;
    }
    default:
      return false;
  }
}

function flattenLeafItems(items: SlashMenuItem[], group?: string): SlashMenuItem[] {
  const result: SlashMenuItem[] = [];

  for (const item of items) {
    const itemGroup = item.group ?? group;
    if (item.children?.length) {
      result.push(...flattenLeafItems(item.children, itemGroup));
      continue;
    }
    if (item.action) {
      result.push(itemGroup ? { ...item, group: itemGroup } : item);
    }
  }

  return result;
}

export function filterSlashMenuItems(rootItems: SlashMenuItem[], query: string): SlashMenuItem[] {
  const trimmed = query.trim().toLowerCase();
  const flat = flattenLeafItems(rootItems);

  if (!trimmed) return flat;

  return flat.filter((item) => {
    if (item.label.toLowerCase().includes(trimmed)) return true;
    return item.keywords?.some((k) => k.toLowerCase().includes(trimmed)) ?? false;
  });
}

export function groupSlashMenuItems(items: SlashMenuItem[]): Map<string, SlashMenuItem[]> {
  const groups = new Map<string, SlashMenuItem[]>();
  for (const item of items) {
    const name = item.group ?? "Other";
    const list = groups.get(name);
    if (list) {
      list.push(item);
    } else {
      groups.set(name, [item]);
    }
  }
  return groups;
}
