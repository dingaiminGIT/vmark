/**
 * Image Operations (Hooks Layer)
 *
 * Async functions for image file operations:
 * - Creating assets folders
 * - Saving/copying images to assets (with deduplication)
 * - Inserting image nodes into ProseMirror
 *
 * Uses Tauri APIs for file system access.
 * Pure helpers (filename generation, etc.) are in utils/imageUtils.
 */

import { mkdir, exists, copyFile, writeFile } from "@tauri-apps/plugin-fs";
import { dirname, join } from "@tauri-apps/api/path";
import type { EditorView } from "@tiptap/pm/view";
import {
  ASSETS_FOLDER,
  generateUniqueFilename,
  getFilename,
  buildAssetRelativePath,
} from "@/utils/imageUtils";
import { computeDataHash, computeFileHash } from "@/utils/imageHash";
import { findExistingImage, registerImageHash } from "@/utils/imageHashRegistry";

/**
 * Get the assets folder path relative to the document.
 */
export async function getAssetsFolder(documentPath: string): Promise<string> {
  const docDir = await dirname(documentPath);
  return join(docDir, ASSETS_FOLDER);
}

/**
 * Ensure the assets folder exists, creating it if necessary.
 */
export async function ensureAssetsFolder(documentPath: string): Promise<string> {
  const assetsPath = await getAssetsFolder(documentPath);

  const assetsExists = await exists(assetsPath);
  if (!assetsExists) {
    await mkdir(assetsPath, { recursive: true });
  }

  return assetsPath;
}

/**
 * Save image data (from clipboard or drag) to the assets folder.
 * Uses content-hash deduplication to avoid saving duplicates.
 * Returns the relative path for markdown insertion.
 */
export async function saveImageToAssets(
  imageData: Uint8Array,
  originalFilename: string,
  documentPath: string
): Promise<string> {
  // Compute hash for deduplication
  const hash = await computeDataHash(imageData);

  // Check if this image already exists
  const existing = await findExistingImage(documentPath, hash);
  if (existing) {
    return existing; // Return existing path, no write needed
  }

  // Image is new, save it
  const assetsPath = await ensureAssetsFolder(documentPath);
  const filename = generateUniqueFilename(originalFilename);
  const destPath = await join(assetsPath, filename);

  await writeFile(destPath, imageData);

  // Register hash for future deduplication
  await registerImageHash(documentPath, hash, filename);

  return buildAssetRelativePath(filename);
}

/**
 * Copy an external image file to the assets folder.
 * Uses content-hash deduplication to avoid saving duplicates.
 * Used by "Insert Image" menu and drag-drop of file paths.
 */
export async function copyImageToAssets(
  sourcePath: string,
  documentPath: string
): Promise<string> {
  // Compute hash for deduplication
  const hash = await computeFileHash(sourcePath);

  // Check if this image already exists
  const existing = await findExistingImage(documentPath, hash);
  if (existing) {
    return existing; // Return existing path, no copy needed
  }

  // Image is new, copy it
  const assetsPath = await ensureAssetsFolder(documentPath);
  const originalName = getFilename(sourcePath);
  const filename = generateUniqueFilename(originalName);
  const destPath = await join(assetsPath, filename);

  await copyFile(sourcePath, destPath);

  // Register hash for future deduplication
  await registerImageHash(documentPath, hash, filename);

  return buildAssetRelativePath(filename);
}

/**
 * Insert an inline image node into the ProseMirror editor.
 * Used by both paste handler and drag-drop handler.
 */
export function insertImageNode(
  view: EditorView,
  src: string,
  pos?: number
): void {
  const { state } = view;
  const imageType = state.schema.nodes.image;
  if (!imageType) return;

  const imageNode = imageType.create({
    src,
    alt: "",
    title: "",
  });

  const insertPos = pos ?? state.selection.from;
  const tr = state.tr.insert(insertPos, imageNode);
  view.dispatch(tr);
}

/**
 * Insert a block image node into the ProseMirror editor.
 * Block images appear on their own line, not inline with text.
 */
export function insertBlockImageNode(
  view: EditorView,
  src: string
): void {
  const { state } = view;
  const blockImageType = state.schema.nodes.block_image;
  if (!blockImageType) {
    // No block_image schema. Prefer inserting an "image" node as a block if available.
    const imageType = state.schema.nodes.image;
    if (imageType && !imageType.isInline) {
      const imageNode = imageType.create({
        src,
        alt: "",
        title: "",
      });

      const { $from } = state.selection;
      const endOfBlock = $from.end($from.depth);
      const insertPos = Math.min(endOfBlock + 1, state.doc.content.size);

      const tr = state.tr.insert(insertPos, imageNode);
      view.dispatch(tr);
      return;
    }

    insertImageNode(view, src);
    return;
  }

  const imageNode = blockImageType.create({
    src,
    alt: "",
    title: "",
  });

  // Find block-level insertion point (after current block)
  const { $from } = state.selection;
  const endOfBlock = $from.end($from.depth);
  const insertPos = Math.min(endOfBlock + 1, state.doc.content.size);

  const tr = state.tr.insert(insertPos, imageNode);
  view.dispatch(tr);
}
