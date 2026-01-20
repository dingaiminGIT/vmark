/**
 * Link Popup Plugin (Tiptap)
 *
 * Reuses the existing DOM popup view (`LinkPopupView`) and store (`linkPopupStore`),
 * but wires it into Tiptap via `addProseMirrorPlugins`.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { Mark } from "@tiptap/pm/model";
import { useLinkPopupStore } from "@/stores/linkPopupStore";
import { findHeadingById } from "@/utils/headingSlug";
import { LinkPopupView } from "./LinkPopupView";

const linkPopupPluginKey = new PluginKey("linkPopup");

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

  // Second pass: find the continuous range with the same href that contains pos
  // We need to find ranges and check if pos falls within them
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
        // Found start of a potential range, extend to find the end
        const rangeFrom = childFrom;
        let rangeTo = childFrom + child.nodeSize;
        const foundMark = mark;

        // Continue checking subsequent children for continuous marks with same href
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

        // Check if pos falls within this range
        if (pos >= rangeFrom && pos < rangeTo) {
          return { mark: foundMark, from: rangeFrom, to: rangeTo };
        }

        // Skip to after this range
        currentOffset = rangeTo - parentStart;
        i = j - 1; // -1 because the for loop will increment
        continue;
      }
    }
    currentOffset += child.nodeSize;
  }

  return null;
}

/** Delay before showing popup on hover (ms) */
const HOVER_DELAY = 300;

/**
 * Navigate to a heading within the document by scrolling and placing cursor.
 */
function navigateToFragment(view: EditorView, targetId: string): boolean {
  const pos = findHeadingById(view.state.doc, targetId);
  if (pos === null) return false;

  try {
    // Set selection near the heading
    const $pos = view.state.doc.resolve(pos + 1);
    const selection = TextSelection.near($pos);
    view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
    view.focus();
    return true;
  } catch (error) {
    console.error("[LinkPopup] Fragment navigation error:", error);
    return false;
  }
}

/**
 * Click handler: Cmd/Ctrl+click opens link in browser or navigates to fragment.
 * Regular click just places cursor (default behavior).
 */
function handleClick(view: EditorView, pos: number, event: MouseEvent): boolean {
  try {
    // Cmd/Ctrl + click: open link or navigate to fragment
    if (event.metaKey || event.ctrlKey) {
      const linkRange = findLinkMarkRange(view, pos);
      if (linkRange) {
        const href = linkRange.mark.attrs.href as string;
        if (href) {
          // Handle fragment links (internal navigation)
          if (href.startsWith("#")) {
            const targetId = href.slice(1);
            if (navigateToFragment(view, targetId)) {
              event.preventDefault();
              return true;
            }
            // Fragment not found - don't try to open as external URL
            return false;
          }

          // External link - open in browser
          import("@tauri-apps/plugin-opener").then(({ openUrl }) => {
            openUrl(href).catch(console.error);
          });
          event.preventDefault();
          return true;
        }
      }
      return false;
    }

    // Regular click: close popup if open, let default cursor placement happen
    if (useLinkPopupStore.getState().isOpen) {
      useLinkPopupStore.getState().closePopup();
    }

    return false;
  } catch (error) {
    console.error("[LinkPopup] Click handler error:", error);
    return false;
  }
}

class LinkPopupPluginView {
  private popupView: LinkPopupView;
  private view: EditorView;
  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentLinkElement: HTMLElement | null = null;

  constructor(view: EditorView) {
    this.view = view;
    this.popupView = new LinkPopupView(view);

    // Add hover listeners to the editor DOM
    view.dom.addEventListener("mouseover", this.handleMouseOver);
    view.dom.addEventListener("mouseout", this.handleMouseOut);
  }

  private handleMouseOver = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const linkElement = target.closest("a") as HTMLElement | null;

    if (!linkElement) {
      // Not hovering a link - clear any pending timeout
      this.clearHoverTimeout();
      return;
    }

    // Same link - ignore
    if (linkElement === this.currentLinkElement) {
      return;
    }

    // Clear any existing timeout
    this.clearHoverTimeout();
    this.currentLinkElement = linkElement;

    // Start hover delay
    this.hoverTimeout = setTimeout(() => {
      this.showPopupForLink(linkElement);
    }, HOVER_DELAY);
  };

  private handleMouseOut = (event: MouseEvent) => {
    const relatedTarget = event.relatedTarget as HTMLElement | null;

    // Check if we're moving to the popup itself
    const popup = document.querySelector(".link-popup");
    if (popup && (popup.contains(relatedTarget) || popup === relatedTarget)) {
      // Moving to popup - don't close
      return;
    }

    // Check if still within a link
    if (relatedTarget?.closest("a")) {
      // Still in a link - let mouseover handle it
      return;
    }

    // Left the link area - clear timeout and close popup after delay
    this.clearHoverTimeout();
    this.currentLinkElement = null;

    // Small delay before closing to allow moving to popup
    this.hoverTimeout = setTimeout(() => {
      // Only close if not hovering the popup
      const popupEl = document.querySelector(".link-popup");
      if (popupEl && !popupEl.matches(":hover")) {
        useLinkPopupStore.getState().closePopup();
      }
    }, 100);
  };

  private showPopupForLink(linkElement: HTMLElement) {
    try {
      // Get the document position from the link element
      const pos = this.view.posAtDOM(linkElement, 0);
      const linkRange = findLinkMarkRange(this.view, pos);

      if (linkRange) {
        const href = linkRange.mark.attrs.href || "";
        const startCoords = this.view.coordsAtPos(linkRange.from);
        const endCoords = this.view.coordsAtPos(linkRange.to);

        useLinkPopupStore.getState().openPopup({
          href,
          linkFrom: linkRange.from,
          linkTo: linkRange.to,
          anchorRect: {
            top: startCoords.top,
            left: startCoords.left,
            bottom: startCoords.bottom,
            right: endCoords.right,
          },
        });
      }
    } catch (error) {
      // Position lookup can fail in edge cases - ignore silently
      if (import.meta.env.DEV) {
        console.debug("[LinkPopup] Failed to show popup for link:", error);
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
    // Popup updates via store subscription
  }

  destroy() {
    this.clearHoverTimeout();
    this.view.dom.removeEventListener("mouseover", this.handleMouseOver);
    this.view.dom.removeEventListener("mouseout", this.handleMouseOut);
    this.popupView.destroy();
  }
}

export const linkPopupExtension = Extension.create({
  name: "linkPopup",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: linkPopupPluginKey,
        view: (editorView) => new LinkPopupPluginView(editorView),
        props: { handleClick },
      }),
    ];
  },
});

