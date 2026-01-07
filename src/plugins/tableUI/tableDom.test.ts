import { describe, expect, it } from "vitest";
import type { EditorView } from "@tiptap/pm/view";
import { getActiveTableElement } from "./tableDom";

type RectOverrides = Partial<DOMRect>;

function createRect(overrides: RectOverrides): DOMRect {
  const base = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
  return { ...base, ...overrides } as DOMRect;
}

function mockRect(el: Element, rect: DOMRect) {
  Object.defineProperty(el, "getBoundingClientRect", {
    value: () => rect,
    configurable: true,
  });
}

function setupTableDom(rects: { container: DOMRect; table: DOMRect }) {
  const container = document.createElement("div");
  container.className = "editor-content";
  const editorDom = document.createElement("div");
  editorDom.className = "ProseMirror";
  container.appendChild(editorDom);

  const table = document.createElement("table");
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.textContent = "cell";
  row.appendChild(cell);
  table.appendChild(row);
  editorDom.appendChild(table);
  document.body.appendChild(container);

  mockRect(container, rects.container);
  mockRect(table, rects.table);

  const textNode = cell.firstChild as Text;
  const range = document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, 1);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);

  const view = { dom: editorDom, root: document } as unknown as EditorView;

  return {
    view,
    table,
    cleanup: () => {
      selection?.removeAllRanges();
      container.remove();
    },
  };
}

describe("getActiveTableElement", () => {
  it("returns the table when selection is inside and visible", () => {
    const { view, table, cleanup } = setupTableDom({
      container: createRect({ top: 0, bottom: 200 }),
      table: createRect({ top: 40, bottom: 80 }),
    });

    expect(getActiveTableElement(view)).toBe(table);
    cleanup();
  });

  it("returns null when the table is outside the container viewport", () => {
    const { view, cleanup } = setupTableDom({
      container: createRect({ top: 0, bottom: 200 }),
      table: createRect({ top: 500, bottom: 560 }),
    });

    expect(getActiveTableElement(view)).toBeNull();
    cleanup();
  });
});
