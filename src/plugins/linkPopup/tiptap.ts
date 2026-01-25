/**
 * Link Popup Plugin (Tiptap)
 *
 * Handles Cmd+Click to open links. The edit popup is triggered by Cmd+K
 * (handled in editorPlugins.tiptap.ts), not by hover.
 *
 * For hover tooltips, see linkTooltip plugin.
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { Mark } from "@tiptap/pm/model";
import { useLinkPopupStore } from "@/stores/linkPopupStore";
import { useLinkTooltipStore } from "@/stores/linkTooltipStore";
import { useLinkCreatePopupStore } from "@/stores/linkCreatePopupStore";
import { findHeadingById } from "@/utils/headingSlug";
import { LinkPopupView } from "./LinkPopupView";

const linkPopupPluginKey = new PluginKey("linkPopup");

interface MarkRange {
  mark: Mark;
  from: number;
  to: number;
}

export function findLinkMarkRange(view: EditorView, pos: number): MarkRange | null {
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

/**
 * Navigate to a heading within the document by scrolling and placing cursor.
 */
function navigateToFragment(view: EditorView, targetId: string): boolean {
  const pos = findHeadingById(view.state.doc, targetId);
  if (pos === null) return false;

  try {
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
 * Regular click just places cursor (default behavior) and closes any open popups.
 */
function handleClick(view: EditorView, pos: number, event: MouseEvent): boolean {
  try {
    // Cmd/Ctrl + click: open link or navigate to fragment
    if (event.metaKey || event.ctrlKey) {
      const linkRange = findLinkMarkRange(view, pos);
      if (linkRange) {
        const href = linkRange.mark.attrs.href as string;
        if (href) {
          // Close tooltip if open
          useLinkTooltipStore.getState().hideTooltip();

          // Handle fragment links (internal navigation)
          if (href.startsWith("#")) {
            const targetId = href.slice(1);
            if (navigateToFragment(view, targetId)) {
              event.preventDefault();
              return true;
            }
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

    // Regular click: close all link popups, let default cursor placement happen
    if (useLinkPopupStore.getState().isOpen) {
      useLinkPopupStore.getState().closePopup();
    }
    if (useLinkTooltipStore.getState().isOpen) {
      useLinkTooltipStore.getState().hideTooltip();
    }
    if (useLinkCreatePopupStore.getState().isOpen) {
      useLinkCreatePopupStore.getState().closePopup();
    }

    return false;
  } catch (error) {
    console.error("[LinkPopup] Click handler error:", error);
    return false;
  }
}

/**
 * Plugin view - only manages the popup view for Cmd+K triggered editing.
 * No hover handling - that's done by linkTooltip plugin.
 */
class LinkPopupPluginView {
  private popupView: LinkPopupView;

  constructor(view: EditorView) {
    this.popupView = new LinkPopupView(view);
  }

  update() {
    // Popup updates via store subscription
  }

  destroy() {
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
