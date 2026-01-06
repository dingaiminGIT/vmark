import type { SlashMenuItem } from "./tiptapSlashMenuUtils";

const chevronRightIcon = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="m9 18 6-6-6-6"/></svg>`;

export function buildMenuItem(item: SlashMenuItem, index: number, isSelected: boolean, hasChildren: boolean): HTMLElement {
  const div = document.createElement("div");
  div.className = `trigger-menu-item${isSelected ? " selected" : ""}${hasChildren ? " has-children" : ""}`;
  div.dataset.index = String(index);

  const iconSpan = document.createElement("span");
  iconSpan.className = "trigger-menu-item-icon";
  iconSpan.innerHTML = item.icon;

  const labelSpan = document.createElement("span");
  labelSpan.className = "trigger-menu-item-label";
  labelSpan.textContent = item.label;

  div.appendChild(iconSpan);
  div.appendChild(labelSpan);

  if (hasChildren) {
    const chevronSpan = document.createElement("span");
    chevronSpan.className = "trigger-menu-item-chevron";
    chevronSpan.innerHTML = chevronRightIcon;
    div.appendChild(chevronSpan);
  }

  return div;
}

export function buildGroup(name: string): HTMLElement {
  const groupDiv = document.createElement("div");
  groupDiv.className = "trigger-menu-group";

  const labelDiv = document.createElement("div");
  labelDiv.className = "trigger-menu-group-label";
  labelDiv.textContent = name;

  groupDiv.appendChild(labelDiv);
  return groupDiv;
}

export function buildEmptyState(): HTMLElement {
  const div = document.createElement("div");
  div.className = "trigger-menu-empty";
  div.textContent = "No results";
  return div;
}

