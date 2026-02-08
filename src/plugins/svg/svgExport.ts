/**
 * SVG Export
 *
 * Adds a PNG export button to SVG code block containers.
 * Shows a light/dark theme picker, converts to 2x PNG, and saves via Tauri dialog.
 *
 * Reuses the same CSS classes as mermaid export (.mermaid-export-btn, etc.)
 * and the same event handling pattern (mousedown + pointerdown + click stopPropagation).
 */

import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { sanitizeSvg } from "@/utils/sanitize";
import { svgToPngBytes } from "@/utils/svgToPng";

const EXPORT_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

const LIGHT_BG = "#ffffff";
const DARK_BG = "#1e1e1e";

interface ExportInstance {
  destroy(): void;
}

export function setupSvgExport(
  container: HTMLElement,
  svgContent: string,
): ExportInstance {
  const resetBtn = container.querySelector<HTMLElement>(".mermaid-panzoom-reset");

  const btn = document.createElement("button");
  btn.className = "mermaid-export-btn";
  btn.title = "Export as PNG";
  btn.innerHTML = EXPORT_ICON_SVG;

  if (resetBtn) {
    container.insertBefore(btn, resetBtn);
  } else {
    container.appendChild(btn);
  }

  let menu: HTMLElement | null = null;

  function closeMenu() {
    if (menu) {
      menu.remove();
      menu = null;
    }
  }

  function showMenu() {
    if (menu) {
      closeMenu();
      return;
    }

    menu = document.createElement("div");
    menu.className = "mermaid-export-menu";

    const rect = btn.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.right}px`;

    const lightItem = createMenuItem("Light", LIGHT_BG, () => doExport("light"));
    const darkItem = createMenuItem("Dark", DARK_BG, () => doExport("dark"));

    menu.appendChild(lightItem);
    menu.appendChild(darkItem);

    document.body.appendChild(menu);

    const menuRect = menu.getBoundingClientRect();
    menu.style.left = `${rect.right - menuRect.width}px`;
  }

  function createMenuItem(
    label: string,
    swatchColor: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const item = document.createElement("button");
    item.className = "mermaid-export-menu-item";

    const swatch = document.createElement("span");
    swatch.className = "mermaid-export-menu-swatch";
    swatch.style.background = swatchColor;

    const text = document.createElement("span");
    text.textContent = label;

    item.appendChild(swatch);
    item.appendChild(text);

    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    item.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });

    return item;
  }

  async function doExport(theme: "light" | "dark") {
    closeMenu();

    const bgColor = theme === "dark" ? DARK_BG : LIGHT_BG;
    const sanitized = sanitizeSvg(svgContent);

    let pngData: Uint8Array;
    try {
      pngData = await svgToPngBytes(sanitized, 2, bgColor);
    } catch (e) {
      console.warn("[svg-export] SVG→PNG conversion failed", e);
      return;
    }

    const filePath = await save({
      defaultPath: "image.png",
      filters: [{ name: "PNG Image", extensions: ["png"] }],
    });
    if (!filePath) return;

    try {
      await writeFile(filePath, pngData);
    } catch (e) {
      console.warn("[svg-export] failed to write file", e);
    }
  }

  // Prevent ProseMirror and panzoom from processing button events
  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  btn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
  });
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showMenu();
  });

  const onClickOutside = (e: MouseEvent) => {
    if (!menu) return;
    if (menu.contains(e.target as Node)) return;
    if (btn.contains(e.target as Node)) return;
    closeMenu();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && menu) {
      closeMenu();
    }
  };

  document.addEventListener("mousedown", onClickOutside);
  document.addEventListener("keydown", onKeyDown);

  function destroy() {
    closeMenu();
    btn.remove();
    document.removeEventListener("mousedown", onClickOutside);
    document.removeEventListener("keydown", onKeyDown);
  }

  return { destroy };
}
