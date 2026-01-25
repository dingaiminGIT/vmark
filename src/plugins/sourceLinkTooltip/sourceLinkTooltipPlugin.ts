/**
 * Source Link Tooltip Plugin
 *
 * CodeMirror 6 plugin for showing read-only tooltip on link hover.
 * The edit popup is triggered by Cmd+K, not by hover.
 * Cmd+Click opens the link or navigates to heading.
 */

import { ViewPlugin, type EditorView, type ViewUpdate } from "@codemirror/view";
import { useLinkTooltipStore } from "@/stores/linkTooltipStore";
import { useLinkPopupStore } from "@/stores/linkPopupStore";
import { SourceLinkTooltipView } from "./SourceLinkTooltipView";
import { findMarkdownLinkAtPosition } from "@/utils/markdownLinkPatterns";
import { getAnchorRectFromRange } from "@/plugins/sourcePopup";
import { extractMarkdownHeadings } from "@/plugins/toolbarActions/sourceAdapterLinks";

/** Delay before showing tooltip on hover (ms) */
const HOVER_DELAY = 300;

/** Delay before hiding tooltip when mouse leaves (ms) */
const HOVER_HIDE_DELAY = 100;

/**
 * Link range result from detection.
 */
interface LinkRange {
  from: number;
  to: number;
  href: string;
  text: string;
}

/**
 * Find link markdown at position.
 */
function findLinkAtPos(view: EditorView, pos: number): LinkRange | null {
  const doc = view.state.doc;
  const line = doc.lineAt(pos);
  const match = findMarkdownLinkAtPosition(line.text, line.from, pos);

  if (!match) return null;

  // Include position at end of link
  if (pos > match.to) return null;

  return {
    from: match.from,
    to: match.to,
    href: match.url,
    text: match.text,
  };
}

/**
 * Create the Source link tooltip plugin.
 */
export function createSourceLinkTooltipPlugin() {
  return ViewPlugin.fromClass(
    class SourceLinkTooltipPluginInstance {
      private tooltipView: SourceLinkTooltipView;
      private hoverTimeout: ReturnType<typeof setTimeout> | null = null;
      private hideTimeout: ReturnType<typeof setTimeout> | null = null;
      private isMouseDown = false;
      private lastHoverRange: { from: number; to: number } | null = null;

      constructor(view: EditorView) {
        this.tooltipView = new SourceLinkTooltipView(view);

        // Set up hover handlers
        view.dom.addEventListener("mousemove", this.handleMouseMove);
        view.dom.addEventListener("mouseleave", this.handleMouseLeave);
        view.dom.addEventListener("mousedown", this.handleMouseDown);
        view.dom.addEventListener("mouseup", this.handleMouseUp);
        view.dom.addEventListener("click", this.handleClick);
      }

      update(_update: ViewUpdate) {
        // Tooltip doesn't need to respond to editor updates
      }

      destroy() {
        this.tooltipView.destroy();
        this.clearTimeouts();
      }

      private handleMouseMove = (e: MouseEvent) => {
        // Don't show tooltip while selecting
        if (this.isMouseDown) {
          this.clearTimeouts();
          return;
        }

        // Don't show tooltip if edit popup is open
        if (useLinkPopupStore.getState().isOpen) {
          this.clearTimeouts();
          return;
        }

        const view = this.tooltipView["editorView"];
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos === null) {
          this.clearTimeouts();
          return;
        }

        // Detect link at mouse position
        const link = findLinkAtPos(view, pos);
        if (!link) {
          this.clearTimeouts();
          this.lastHoverRange = null;
          return;
        }

        // If same range as before, don't restart timer
        if (
          this.lastHoverRange &&
          this.lastHoverRange.from === link.from &&
          this.lastHoverRange.to === link.to
        ) {
          return;
        }

        this.lastHoverRange = { from: link.from, to: link.to };
        this.clearTimeouts();

        // Start hover timer
        this.hoverTimeout = setTimeout(() => {
          // Double-check still valid
          if (this.isMouseDown) return;
          if (useLinkPopupStore.getState().isOpen) return;

          const anchorRect = getAnchorRectFromRange(view, link.from, link.to);
          if (!anchorRect) return;

          useLinkTooltipStore.getState().showTooltip({
            href: link.href,
            anchorRect,
          });
        }, HOVER_DELAY);
      };

      private handleMouseLeave = () => {
        this.clearTimeouts();
        this.lastHoverRange = null;

        // Start hide timer
        if (useLinkTooltipStore.getState().isOpen) {
          this.hideTimeout = setTimeout(() => {
            // Check if mouse is now over the tooltip
            const tooltipEl = document.querySelector(".link-tooltip");
            if (tooltipEl && tooltipEl.matches(":hover")) {
              return;
            }
            useLinkTooltipStore.getState().hideTooltip();
          }, HOVER_HIDE_DELAY);
        }
      };

      private handleMouseDown = () => {
        this.isMouseDown = true;
        this.clearTimeouts();
      };

      private handleMouseUp = () => {
        this.isMouseDown = false;
      };

      private handleClick = (e: MouseEvent) => {
        // Close tooltip on any click
        if (useLinkTooltipStore.getState().isOpen) {
          useLinkTooltipStore.getState().hideTooltip();
        }

        // Check for Cmd+Click (Mac) or Ctrl+Click (Windows)
        const isCmdClick = e.metaKey || e.ctrlKey;
        if (!isCmdClick) return;

        const view = this.tooltipView["editorView"];
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos === null) return;

        const link = findLinkAtPos(view, pos);
        if (!link) return;

        // Prevent default click behavior and cursor placement
        e.preventDefault();

        const { href } = link;

        // Handle bookmark links - navigate to heading
        if (href.startsWith("#")) {
          const targetId = href.slice(1);
          const docText = view.state.doc.toString();
          const headings = extractMarkdownHeadings(docText);
          const heading = headings.find((h) => h.id === targetId);

          if (heading && heading.pos !== undefined) {
            // Position cursor at the heading
            view.dispatch({
              selection: { anchor: heading.pos },
              scrollIntoView: true,
            });
            view.focus();
          }
          return;
        }

        // External link - open in browser
        import("@tauri-apps/plugin-opener").then(({ openUrl }) => {
          openUrl(href).catch((error: unknown) => {
            console.error("Failed to open link:", error);
          });
        });
      };

      private clearTimeouts() {
        if (this.hoverTimeout) {
          clearTimeout(this.hoverTimeout);
          this.hoverTimeout = null;
        }
        if (this.hideTimeout) {
          clearTimeout(this.hideTimeout);
          this.hideTimeout = null;
        }
      }
    }
  );
}
