/**
 * Link Tooltip Plugin (Tiptap)
 *
 * Shows a read-only tooltip on hover over links.
 * For editing, use Cmd+K which opens the edit popup.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { Mark } from "@tiptap/pm/model";
import { useLinkTooltipStore } from "@/stores/linkTooltipStore";
import { useLinkPopupStore } from "@/stores/linkPopupStore";
import { LinkTooltipView } from "./LinkTooltipView";

const linkTooltipPluginKey = new PluginKey("linkTooltip");

/** Delay before showing tooltip on hover (ms) */
const HOVER_DELAY = 300;

interface MarkRange {
  mark: Mark;
  from: number;
  to: number;
}

function findLinkMarkRange(view: EditorView, pos: number): MarkRange | null {
  const { state } = view;
  const $pos = state.doc.resolve(pos);
  const parent = $pos.parent;
  const parentStart = $pos.start();

  // First pass: find the link mark at the given position
  let linkMark: Mark | null = null;
  let currentOffset = 0;

  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    const childFrom = parentStart + currentOffset;
    const childTo = childFrom + child.nodeSize;

    if (pos >= childFrom && pos < childTo && child.isText) {
      const mark = child.marks.find((m) => m.type.name === "link");
      if (mark) {
        linkMark = mark;
        break;
      }
    }
    currentOffset += child.nodeSize;
  }

  if (!linkMark) return null;

  // Second pass: find the continuous range with the same href
  const targetHref = linkMark.attrs.href;
  currentOffset = 0;

  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    const childFrom = parentStart + currentOffset;

    if (child.isText) {
      const mark = child.marks.find(
        (m) => m.type.name === "link" && m.attrs.href === targetHref
      );

      if (mark) {
        const rangeFrom = childFrom;
        let rangeTo = childFrom + child.nodeSize;
        const foundMark = mark;

        // Continue checking subsequent children
        let j = i + 1;
        while (j < parent.childCount) {
          const nextChild = parent.child(j);
          if (nextChild.isText) {
            const nextMark = nextChild.marks.find(
              (m) => m.type.name === "link" && m.attrs.href === targetHref
            );
            if (nextMark) {
              rangeTo += nextChild.nodeSize;
              j++;
            } else {
              break;
            }
          } else {
            break;
          }
        }

        if (pos >= rangeFrom && pos < rangeTo) {
          return { mark: foundMark, from: rangeFrom, to: rangeTo };
        }

        currentOffset = rangeTo - parentStart;
        i = j - 1;
        continue;
      }
    }
    currentOffset += child.nodeSize;
  }

  return null;
}

class LinkTooltipPluginView {
  private tooltipView: LinkTooltipView;
  private view: EditorView;
  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentLinkElement: HTMLElement | null = null;

  constructor(view: EditorView) {
    this.view = view;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.tooltipView = new LinkTooltipView(view as any);

    // Add hover listeners
    view.dom.addEventListener("mouseover", this.handleMouseOver);
    view.dom.addEventListener("mouseout", this.handleMouseOut);
  }

  private handleMouseOver = (event: MouseEvent) => {
    // Don't show tooltip if edit popup is open
    if (useLinkPopupStore.getState().isOpen) {
      return;
    }

    const target = event.target as HTMLElement;
    const linkElement = target.closest("a") as HTMLElement | null;

    if (!linkElement) {
      this.clearHoverTimeout();
      return;
    }

    // Same link - ignore
    if (linkElement === this.currentLinkElement) {
      return;
    }

    this.clearHoverTimeout();
    this.currentLinkElement = linkElement;

    // Start hover delay
    this.hoverTimeout = setTimeout(() => {
      this.showTooltipForLink(linkElement);
    }, HOVER_DELAY);
  };

  private handleMouseOut = (event: MouseEvent) => {
    const relatedTarget = event.relatedTarget as HTMLElement | null;

    // Check if we're moving to the tooltip itself
    const tooltip = document.querySelector(".link-tooltip");
    if (tooltip && (tooltip.contains(relatedTarget) || tooltip === relatedTarget)) {
      return;
    }

    // Check if still within a link
    if (relatedTarget?.closest("a")) {
      return;
    }

    // Left the link area
    this.clearHoverTimeout();
    this.currentLinkElement = null;

    // Small delay before closing to allow moving to tooltip
    this.hoverTimeout = setTimeout(() => {
      const tooltipEl = document.querySelector(".link-tooltip");
      if (tooltipEl && !tooltipEl.matches(":hover")) {
        useLinkTooltipStore.getState().hideTooltip();
      }
    }, 100);
  };

  private showTooltipForLink(linkElement: HTMLElement) {
    // Don't show if edit popup opened while waiting
    if (useLinkPopupStore.getState().isOpen) {
      return;
    }

    try {
      const pos = this.view.posAtDOM(linkElement, 0);
      const linkRange = findLinkMarkRange(this.view, pos);

      if (linkRange) {
        const href = linkRange.mark.attrs.href || "";
        const startCoords = this.view.coordsAtPos(linkRange.from);
        const endCoords = this.view.coordsAtPos(linkRange.to);

        useLinkTooltipStore.getState().showTooltip({
          href,
          anchorRect: {
            top: startCoords.top,
            left: startCoords.left,
            bottom: startCoords.bottom,
            right: endCoords.right,
          },
        });
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.debug("[LinkTooltip] Failed to show tooltip:", error);
      }
    }
  }

  private clearHoverTimeout() {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }

  update() {
    // Tooltip updates via store subscription
  }

  destroy() {
    this.clearHoverTimeout();
    this.view.dom.removeEventListener("mouseover", this.handleMouseOver);
    this.view.dom.removeEventListener("mouseout", this.handleMouseOut);
    this.tooltipView.destroy();
  }
}

export const linkTooltipExtension = Extension.create({
  name: "linkTooltip",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: linkTooltipPluginKey,
        view: (editorView) => new LinkTooltipPluginView(editorView),
      }),
    ];
  },
});
