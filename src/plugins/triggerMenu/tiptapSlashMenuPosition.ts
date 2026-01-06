type MenuLevelForPosition = {
  container: HTMLElement;
  parentItemEl: HTMLElement | null;
};

export function positionSubmenu(menuEl: HTMLElement, level: MenuLevelForPosition): void {
  if (!level.parentItemEl) return;
  const menuRect = menuEl.getBoundingClientRect();
  const itemRect = level.parentItemEl.getBoundingClientRect();

  level.container.style.left = `${itemRect.right - menuRect.left + 4}px`;
  level.container.style.top = `${itemRect.top - menuRect.top}px`;
}

export function updateMenuPosition(
  menuEl: HTMLElement,
  coords: { left: number; bottom: number },
  levels: MenuLevelForPosition[]
): void {
  menuEl.style.left = `${coords.left + window.scrollX}px`;
  menuEl.style.top = `${coords.bottom + window.scrollY}px`;

  const rect = menuEl.getBoundingClientRect();
  const padding = 8;

  let nextLeft = rect.left;
  let nextTop = rect.top;

  if (rect.right > window.innerWidth - padding) {
    nextLeft = Math.max(padding, window.innerWidth - rect.width - padding);
  }
  if (rect.bottom > window.innerHeight - padding) {
    nextTop = Math.max(padding, window.innerHeight - rect.height - padding);
  }

  if (nextLeft !== rect.left) menuEl.style.left = `${nextLeft + window.scrollX}px`;
  if (nextTop !== rect.top) menuEl.style.top = `${nextTop + window.scrollY}px`;

  for (let i = 1; i < levels.length; i++) {
    positionSubmenu(menuEl, levels[i]);
  }
}

