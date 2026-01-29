/**
 * Resource Resolver
 *
 * Handles image bundling and URL rewriting for export.
 * Resolves relative paths, copies local files, and rewrites URLs.
 */

import { readFile, copyFile, exists, mkdir } from "@tauri-apps/plugin-fs";
import { join, dirname, basename } from "@tauri-apps/api/path";

export interface ResourceInfo {
  /** Original src value from HTML */
  originalSrc: string;
  /** Resolved absolute path (for local files) */
  resolvedPath: string | null;
  /** New src to use in exported HTML */
  exportSrc: string;
  /** Whether the resource is remote (http/https) */
  isRemote: boolean;
  /** Whether the resource was found/accessible */
  found: boolean;
  /** File size in bytes (if known) */
  size?: number;
}

export interface ResourceReport {
  /** All resources found in the document */
  resources: ResourceInfo[];
  /** Resources that were successfully resolved */
  resolved: ResourceInfo[];
  /** Resources that were not found */
  missing: ResourceInfo[];
  /** Total size of resolved resources */
  totalSize: number;
}

export interface ResolveOptions {
  /** Base directory for resolving relative paths (usually document directory) */
  baseDir: string;
  /** Export mode: 'folder' creates assets folder, 'single' embeds as data URIs */
  mode: "folder" | "single";
  /** Output directory for folder mode */
  outputDir?: string;
  /** Document name (used for assets folder name) */
  documentName?: string;
}

/**
 * Check if a URL is remote (http/https).
 */
export function isRemoteUrl(src: string): boolean {
  return src.startsWith("http://") || src.startsWith("https://");
}

/**
 * Check if a URL is a data URI.
 */
export function isDataUri(src: string): boolean {
  return src.startsWith("data:");
}

/**
 * Check if a URL is a Tauri asset URL.
 */
export function isAssetUrl(src: string): boolean {
  return src.startsWith("asset://") || src.startsWith("tauri://");
}

/**
 * Extract image sources from HTML content.
 */
export function extractImageSources(html: string): string[] {
  const sources: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (src && !isDataUri(src)) {
      sources.push(src);
    }
  }

  return sources;
}

/**
 * Resolve a relative path against a base directory.
 */
export async function resolveRelativePath(
  src: string,
  baseDir: string
): Promise<string> {
  // Handle absolute paths
  if (src.startsWith("/")) {
    return src;
  }

  // Handle asset URLs - extract the path
  if (isAssetUrl(src)) {
    try {
      const url = new URL(src);
      return decodeURIComponent(url.pathname);
    } catch (error) {
      console.warn("[ResourceResolver] Failed to parse asset URL:", src, error);
      return src;
    }
  }

  // Resolve relative to base directory
  return await join(baseDir, src);
}

/**
 * Convert a file to a data URI.
 */
export async function fileToDataUri(filePath: string): Promise<string | null> {
  try {
    const data = await readFile(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = getMimeType(ext);
    const base64 = btoa(String.fromCharCode(...data));
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.warn("[ResourceResolver] Failed to read file for data URI:", filePath, error);
    return null;
  }
}

/**
 * Get MIME type for a file extension.
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    bmp: "image/bmp",
    avif: "image/avif",
  };
  return mimeTypes[ext] ?? "application/octet-stream";
}

/**
 * Resolve all resources in HTML content.
 *
 * For folder mode:
 * - Local files are copied to assets folder
 * - URLs are rewritten to relative paths
 *
 * For single mode:
 * - Local files are embedded as data URIs
 *
 * @param html - The HTML content to process
 * @param options - Resolution options
 * @returns Report of all resources and the modified HTML
 */
export async function resolveResources(
  html: string,
  options: ResolveOptions
): Promise<{ html: string; report: ResourceReport }> {
  const { baseDir, mode, outputDir, documentName } = options;
  const sources = extractImageSources(html);

  const resources: ResourceInfo[] = [];
  const resolved: ResourceInfo[] = [];
  const missing: ResourceInfo[] = [];
  let totalSize = 0;

  // Create assets directory for folder mode
  const assetsDir =
    mode === "folder" && outputDir
      ? await join(outputDir, `${documentName ?? "document"}.assets`)
      : null;

  if (assetsDir) {
    try {
      const assetsDirExists = await exists(assetsDir);
      if (!assetsDirExists) {
        await mkdir(assetsDir, { recursive: true });
      }
    } catch (e) {
      console.warn("[ResourceResolver] Failed to create assets directory:", e);
    }
  }

  let modifiedHtml = html;

  for (const src of sources) {
    const info: ResourceInfo = {
      originalSrc: src,
      resolvedPath: null,
      exportSrc: src,
      isRemote: isRemoteUrl(src),
      found: false,
    };

    // Skip remote URLs - keep as-is
    if (info.isRemote) {
      info.found = true;
      resources.push(info);
      resolved.push(info);
      continue;
    }

    // Resolve local path
    try {
      const resolvedPath = await resolveRelativePath(src, baseDir);
      info.resolvedPath = resolvedPath;

      // Check if file exists
      const fileExists = await exists(resolvedPath);
      if (!fileExists) {
        info.found = false;
        resources.push(info);
        missing.push(info);
        continue;
      }

      info.found = true;

      if (mode === "single") {
        // Embed as data URI
        const dataUri = await fileToDataUri(resolvedPath);
        if (dataUri) {
          info.exportSrc = dataUri;
          modifiedHtml = modifiedHtml.split(src).join(dataUri);
        }
      } else if (mode === "folder" && assetsDir) {
        // Copy to assets folder
        const fileName = await basename(resolvedPath);
        const destPath = await join(assetsDir, fileName);

        try {
          await copyFile(resolvedPath, destPath);
          const relativePath = `${documentName ?? "document"}.assets/${fileName}`;
          info.exportSrc = relativePath;
          modifiedHtml = modifiedHtml.split(src).join(relativePath);
        } catch (e) {
          console.warn(`[ResourceResolver] Failed to copy ${resolvedPath}:`, e);
        }
      }

      // Try to get file size (may fail if file was just copied/moved)
      try {
        const data = await readFile(resolvedPath);
        info.size = data.length;
        totalSize += data.length;
      } catch {
        // Size unknown - not critical, continue without it
      }

      resources.push(info);
      resolved.push(info);
    } catch (e) {
      console.warn(`[ResourceResolver] Failed to resolve ${src}:`, e);
      info.found = false;
      resources.push(info);
      missing.push(info);
    }
  }

  return {
    html: modifiedHtml,
    report: {
      resources,
      resolved,
      missing,
      totalSize,
    },
  };
}

/**
 * Get the document's base directory from its file path.
 */
export async function getDocumentBaseDir(filePath: string | null): Promise<string> {
  if (!filePath) {
    // Return current working directory or home as fallback
    return "/";
  }
  return await dirname(filePath);
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
