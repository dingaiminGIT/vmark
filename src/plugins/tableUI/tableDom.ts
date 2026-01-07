import type { EditorView } from "@tiptap/pm/view";

function getSelectionAnchorElement(view: EditorView): Element | null {
  const selection = view.root instanceof Document ? view.root.getSelection() : window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const node = selection.anchorNode ?? selection.focusNode;
  if (!node) return null;

  return node instanceof Element ? node : node.parentElement;
}

function isElementVisibleInContainer(element: Element, container: HTMLElement): boolean {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  return elementRect.bottom >= containerRect.top && elementRect.top <= containerRect.bottom;
}

export function getActiveTableElement(view: EditorView): HTMLTableElement | null {
  const anchorElement = getSelectionAnchorElement(view);
  if (!anchorElement) return null;

  const table = anchorElement.closest("table");
  if (!(table instanceof HTMLTableElement)) return null;

  const scrollContainer = view.dom.closest(".editor-content") as HTMLElement | null;
  if (!scrollContainer) return table;

  if (!isElementVisibleInContainer(table, scrollContainer)) return null;

  return table;
}
