/**
 * Export System
 *
 * Provides visual-parity export for VMark documents.
 * Uses ExportSurface (read-only Tiptap) to guarantee
 * the same rendering as the WYSIWYG editor.
 *
 * @module export
 */

// Core components
export { ExportSurface } from "./ExportSurface";
export type { ExportSurfaceProps, ExportSurfaceRef } from "./ExportSurface";

// Extensions
export { createExportExtensions } from "./createExportExtensions";

// Stability
export { waitForAssets, waitForAllImages, getStabilityStatus } from "./waitForAssets";
export type { StabilityOptions, StabilityStatus, StabilityResult } from "./waitForAssets";

// Theme
export {
  captureThemeSnapshot,
  generateThemeCSS,
  captureThemeCSS,
  isDarkTheme,
  capturePartialSnapshot,
  EXPORT_CSS_VARS,
} from "./themeSnapshot";
export type { ThemeSnapshot, CSSVarName } from "./themeSnapshot";

// Resources
export {
  resolveResources,
  extractImageSources,
  isRemoteUrl,
  isDataUri,
  getDocumentBaseDir,
  formatFileSize,
} from "./resourceResolver";
export type { ResourceInfo, ResourceReport, ResolveOptions } from "./resourceResolver";

// Fonts
export {
  embedFonts,
  getKaTeXFontCSS,
  getFontsFromSettings,
  generateExportFontCSS,
  contentHasMath,
  getGoogleFontUrl,
  getKaTeXFontFiles,
  getUserFontFile,
  downloadFont,
  generateLocalFontCSS,
  KATEX_FONTS,
} from "./fontEmbedder";
export type { FontConfig, FontEmbedResult, FontFile, DownloadedFont } from "./fontEmbedder";

// HTML Export
export { exportHtml, copyHtmlToClipboard } from "./htmlExport";
export type { HtmlExportOptions, HtmlExportResult } from "./htmlExport";

// Export Operations
export {
  exportToHtml,
  exportToPdf,
  copyAsHtml,
  getRenderedHtml,
} from "./useExportOperations";
export type { ExportToHtmlOptions } from "./useExportOperations";
