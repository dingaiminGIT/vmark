export interface SlashMenuItem {
  label: string;
  icon: string;
  group?: string;
  keywords?: string[];
  action?: () => void | boolean | Promise<void>;
  children?: SlashMenuItem[];
}

export function parseSlashTrigger(textBeforeCursor: string): { query: string; slashIndex: number } | null {
  const match = /(?:^|\s)\/([^\s]*)$/.exec(textBeforeCursor);
  if (!match) return null;

  const slashIndexInMatch = match[0].indexOf("/");
  if (slashIndexInMatch === -1) return null;

  return {
    query: match[1] ?? "",
    slashIndex: match.index + slashIndexInMatch,
  };
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
