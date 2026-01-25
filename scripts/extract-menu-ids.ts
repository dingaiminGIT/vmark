#!/usr/bin/env npx tsx
/**
 * Extracts menu IDs from src-tauri/src/menu.rs and generates shared/menu-ids.json
 *
 * Usage: npx tsx scripts/extract-menu-ids.ts
 *
 * This script parses the Rust menu.rs file and extracts all MenuItem::with_id
 * declarations to create a single source of truth for menu IDs.
 */

import fs from "node:fs";
import path from "node:path";

const MENU_RS_PATH = path.join(process.cwd(), "src-tauri/src/menu.rs");
const OUTPUT_PATH = path.join(process.cwd(), "shared/menu-ids.json");

// Regex to match MenuItem::with_id(app, "menu-id", ...)
// Captures the menu ID string
const MENU_ITEM_REGEX = /MenuItem::with_id\s*\(\s*app\s*,\s*"([^"]+)"/g;

// Menu IDs that are dynamic or internal (not routed to frontend actions)
const EXCLUDED_IDS = new Set([
  "no-recent", // Placeholder
  "clear-recent", // File menu action
  "preferences", // Opens settings
  "check-updates", // Help menu action
  // File operations (handled separately)
  "new",
  "new-window",
  "open",
  "open-folder",
  "close-workspace",
  "save",
  "save-as",
  "close",
  "cleanup-images",
  "export-html",
  "save-pdf",
  "export-pdf",
  "copy-html",
  // Find operations (handled by find bar)
  "find-replace",
  "find-next",
  "find-prev",
  "use-selection-find",
  // History operations
  "view-history",
  "clear-history",
  // View toggles (handled separately)
  "source-mode",
  "focus-mode",
  "typewriter-mode",
  "word-wrap",
  "line-numbers",
  "diagram-preview",
  "sidebar",
  "outline",
  "terminal",
]);

function extractMenuIds(): string[] {
  const content = fs.readFileSync(MENU_RS_PATH, "utf-8");
  const menuIds = new Set<string>();

  let match;
  while ((match = MENU_ITEM_REGEX.exec(content)) !== null) {
    const menuId = match[1];
    // Skip dynamic IDs (e.g., recent-file-{n})
    if (menuId.includes("{")) continue;
    menuIds.add(menuId);
  }

  return Array.from(menuIds).sort();
}

function categorizeMenuIds(allIds: string[]): {
  editorActions: string[];
  fileActions: string[];
  viewActions: string[];
  excluded: string[];
} {
  const editorActions: string[] = [];
  const fileActions: string[] = [];
  const viewActions: string[] = [];
  const excluded: string[] = [];

  for (const id of allIds) {
    if (EXCLUDED_IDS.has(id)) {
      excluded.push(id);
    } else if (
      id.startsWith("source-") ||
      id.startsWith("focus-") ||
      id.startsWith("typewriter-") ||
      id === "word-wrap" ||
      id === "line-numbers" ||
      id === "diagram-preview" ||
      id === "sidebar" ||
      id === "outline" ||
      id === "terminal"
    ) {
      viewActions.push(id);
    } else if (
      id === "new" ||
      id === "open" ||
      id === "save" ||
      id.startsWith("export-") ||
      id.startsWith("save-")
    ) {
      fileActions.push(id);
    } else {
      editorActions.push(id);
    }
  }

  return { editorActions, fileActions, viewActions, excluded };
}

function main() {
  console.log("Extracting menu IDs from:", MENU_RS_PATH);

  const allIds = extractMenuIds();
  const { editorActions } = categorizeMenuIds(allIds);

  const output = {
    // All menu IDs that should be handled by the unified menu dispatcher
    menuIds: editorActions,
    // All extracted IDs for reference
    allMenuIds: allIds,
    // Timestamp
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(`Generated ${OUTPUT_PATH} with ${editorActions.length} editor action IDs`);
  console.log("Editor actions:", editorActions.join(", "));
}

main();
