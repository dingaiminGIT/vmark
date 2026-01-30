/**
 * Settings Window Utility
 *
 * Shared logic for opening the Settings window, centered on the current window.
 */

import { emit } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LogicalPosition } from "@tauri-apps/api/dpi";

const SETTINGS_WIDTH = 760;
const SETTINGS_HEIGHT = 540;

/**
 * Calculate position to center Settings window over the current window.
 * Returns null if position cannot be determined.
 */
async function calculateCenteredPosition(): Promise<{ x: number; y: number } | null> {
  try {
    const currentWindow = getCurrentWebviewWindow();
    const scaleFactor = await currentWindow.scaleFactor();
    const [position, size] = await Promise.all([
      currentWindow.outerPosition(),
      currentWindow.outerSize(),
    ]);
    // Convert physical pixels to logical pixels
    const x = Math.round(position.x / scaleFactor + (size.width / scaleFactor - SETTINGS_WIDTH) / 2);
    const y = Math.round(position.y / scaleFactor + (size.height / scaleFactor - SETTINGS_HEIGHT) / 2);
    return { x, y };
  } catch {
    return null;
  }
}

/**
 * Open the Settings window, optionally navigating to a specific section.
 *
 * - If Settings window exists, focuses it and navigates to the section
 * - If not, creates a new Settings window centered on the current window
 *
 * @param section - Optional section to navigate to (e.g., "integrations", "updates")
 */
export async function openSettingsWindow(section?: string): Promise<void> {
  const pos = await calculateCenteredPosition();

  // If Settings window already exists, focus and navigate
  const existing = await WebviewWindow.getByLabel("settings");
  if (existing) {
    if (pos) {
      await existing.setPosition(new LogicalPosition(pos.x, pos.y));
    }
    await existing.setFocus();
    if (section) {
      await emit("settings:navigate", section);
    }
    return;
  }

  // Create new Settings window
  const url = section ? `/settings?section=${section}` : "/settings";
  new WebviewWindow("settings", {
    url,
    title: "Settings",
    width: SETTINGS_WIDTH,
    height: SETTINGS_HEIGHT,
    minWidth: 600,
    minHeight: 400,
    x: pos?.x,
    y: pos?.y,
    center: !pos,
    resizable: true,
    hiddenTitle: true,
    titleBarStyle: "overlay",
  });
}
