import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { parseMarkdown } from "@/utils/markdownPipeline";
import { createExportExtensions } from "./createExportExtensions";
import "./exportStyles.css";

export interface ExportSurfaceProps {
  /** Markdown content to render */
  markdown: string;
  /** Called when rendering is complete and stable */
  onReady?: () => void;
  /** Called if rendering fails */
  onError?: (error: Error) => void;
  /** Whether to use light theme (default: true) */
  lightTheme?: boolean;
  /** Additional CSS class for the container */
  className?: string;
}

export interface ExportSurfaceRef {
  /** Get the rendered HTML content */
  getHTML: () => string;
  /** Get the container element */
  getContainer: () => HTMLElement | null;
}

/**
 * ExportSurface renders markdown using a read-only Tiptap editor.
 *
 * This component guarantees visual parity with the WYSIWYG editor by using
 * the same extensions and CSS. It's designed for export/print scenarios
 * where we need the exact same rendering as the editor.
 *
 * Features:
 * - Read-only (no editing interactions)
 * - Same extensions as editor (minus interactive popups/tooltips)
 * - Math/Mermaid rendering via codePreviewExtension
 * - Async stability detection (waits for fonts, images, async renders)
 *
 * @example
 * ```tsx
 * <ExportSurface
 *   markdown="# Hello\n\n$$E=mc^2$$"
 *   onReady={() => console.log('Ready to export')}
 * />
 * ```
 */
export const ExportSurface = forwardRef<ExportSurfaceRef, ExportSurfaceProps>(
  function ExportSurface(
    { markdown, onReady, onError, lightTheme = true, className },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const stabilityCheckRef = useRef<number | null>(null);
    const onReadyCalledRef = useRef(false);

    // Create extensions once
    const extensions = createExportExtensions();

    const editor = useEditor({
      extensions,
      editable: false,
      editorProps: {
        attributes: {
          class: "export-surface-editor tiptap-editor",
          "data-export-mode": "true",
        },
      },
    });

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getHTML: () => {
        if (!containerRef.current) return "";
        const editorEl = containerRef.current.querySelector(".ProseMirror");
        return editorEl?.innerHTML ?? "";
      },
      getContainer: () => containerRef.current,
    }));

    // Check if all async content has rendered
    const checkStability = useCallback(async (): Promise<boolean> => {
      if (!containerRef.current) return false;

      // Check for pending math renders (placeholder text)
      const mathPlaceholders = containerRef.current.querySelectorAll(
        ".code-block-preview-placeholder"
      );
      if (mathPlaceholders.length > 0) return false;

      // Check for pending mermaid renders
      const mermaidLoading = containerRef.current.querySelectorAll(
        ".mermaid-loading"
      );
      if (mermaidLoading.length > 0) return false;

      // Check for images still loading
      const images = containerRef.current.querySelectorAll("img");
      for (const img of images) {
        if (!img.complete) return false;
      }

      // Wait for fonts
      try {
        await document.fonts.ready;
      } catch {
        // Font API not available in some environments, continue
      }

      return true;
    }, []);

    // Poll for stability then call onReady
    const waitForStability = useCallback(async () => {
      if (onReadyCalledRef.current) return;

      const maxAttempts = 50; // 5 seconds max
      let attempts = 0;

      const check = async () => {
        attempts++;
        const isStable = await checkStability();

        if (isStable) {
          // Extra frame for layout
          requestAnimationFrame(() => {
            if (!onReadyCalledRef.current) {
              onReadyCalledRef.current = true;
              onReady?.();
            }
          });
        } else if (attempts < maxAttempts) {
          stabilityCheckRef.current = window.setTimeout(check, 100);
        } else {
          // Timeout - call onReady anyway with warning
          console.warn("[ExportSurface] Stability timeout reached, proceeding anyway");
          if (!onReadyCalledRef.current) {
            onReadyCalledRef.current = true;
            onReady?.();
          }
        }
      };

      // Start checking after a short delay for initial render
      stabilityCheckRef.current = window.setTimeout(check, 100);
    }, [checkStability, onReady]);

    // Load content when editor is ready
    useEffect(() => {
      if (!editor || !markdown) return;

      try {
        const doc = parseMarkdown(editor.schema, markdown);
        editor.commands.setContent(doc.toJSON());

        // Start stability check
        waitForStability();
      } catch (error) {
        console.error("[ExportSurface] Failed to parse markdown:", error);
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }, [editor, markdown, waitForStability, onError]);

    // Cleanup
    useEffect(() => {
      return () => {
        if (stabilityCheckRef.current) {
          clearTimeout(stabilityCheckRef.current);
        }
      };
    }, []);

    const themeClass = lightTheme ? "" : "dark-theme";

    return (
      <div
        ref={containerRef}
        className={`export-surface ${themeClass} ${className ?? ""}`}
      >
        <EditorContent editor={editor} />
      </div>
    );
  }
);
