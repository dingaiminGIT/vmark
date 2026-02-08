/**
 * Mermaid Export
 *
 * Adds a PNG export button to mermaid diagram containers.
 * Shows a light/dark theme picker, renders SVG with the chosen theme,
 * converts to 2x PNG, and saves via Tauri dialog.
 */

import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { renderMermaidForExport } from "./index";

const EXPORT_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

const LIGHT_BG = "#ffffff";
const DARK_BG = "#1e1e1e";

interface ExportInstance {
  destroy(): void;
}

export function setupMermaidExport(
  container: HTMLElement,
  mermaidSource: string,
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

    // Position fixed relative to the button's viewport coords
    const rect = btn.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.right}px`;

    const lightItem = createMenuItem("Light", LIGHT_BG, () => doExport("light"));
    const darkItem = createMenuItem("Dark", DARK_BG, () => doExport("dark"));

    menu.appendChild(lightItem);
    menu.appendChild(darkItem);

    // Append to document.body to escape overflow:hidden container
    document.body.appendChild(menu);

    // Align right edge of menu with right edge of button
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

    // Prevent ProseMirror from capturing mousedown
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

    const svg = await renderMermaidForExport(mermaidSource, theme);
    if (!svg) {
      console.warn("[mermaid-export] render returned no SVG");
      return;
    }

    const bgColor = theme === "dark" ? DARK_BG : LIGHT_BG;

    let pngData: Uint8Array;
    try {
      pngData = await svgToPngBytes(svg, 2, bgColor);
    } catch (e) {
      console.warn("[mermaid-export] SVG→PNG conversion failed", e);
      return;
    }

    const filePath = await save({
      defaultPath: "diagram.png",
      filters: [{ name: "PNG Image", extensions: ["png"] }],
    });
    if (!filePath) return;

    try {
      await writeFile(filePath, pngData);
    } catch (e) {
      console.warn("[mermaid-export] failed to write file", e);
    }
  }

  // --- Button event listeners ---
  // Must stop both mousedown AND pointerdown to prevent ProseMirror
  // and panzoom from processing the event
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

/**
 * Convert SVG string to PNG Uint8Array at the given scale.
 * Adds a solid background rect since SVG defaults to transparent.
 */
async function svgToPngBytes(
  svgString: string,
  scale: number,
  bgColor: string,
): Promise<Uint8Array> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const svgEl = doc.documentElement;

  const viewBox = svgEl.getAttribute("viewBox");
  let width: number;
  let height: number;
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    width = parts[2];
    height = parts[3];
  } else {
    width = parseFloat(svgEl.getAttribute("width") || "800");
    height = parseFloat(svgEl.getAttribute("height") || "600");
  }

  // Insert background rect as first child
  const bgRect = doc.createElementNS("http://www.w3.org/2000/svg", "rect");
  bgRect.setAttribute("width", "100%");
  bgRect.setAttribute("height", "100%");
  bgRect.setAttribute("fill", bgColor);
  svgEl.insertBefore(bgRect, svgEl.firstChild);

  // Ensure explicit dimensions (not %)
  svgEl.setAttribute("width", String(width));
  svgEl.setAttribute("height", String(height));

  const serialized = new XMLSerializer().serializeToString(svgEl);
  // Use data URL (not blob URL) to avoid tainting the canvas.
  // Blob URLs are treated as cross-origin in WebKit, which blocks toBlob().
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (pngBlob) => {
          if (!pngBlob) {
            reject(new Error("Failed to create PNG"));
            return;
          }
          pngBlob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
        },
        "image/png",
      );
    };
    img.onerror = () => {
      reject(new Error("Failed to load SVG"));
    };
    img.src = dataUrl;
  });
}
