import { Node } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { NodeView } from "@tiptap/pm/view";
import { loadKatex } from "./katexLoader";
import { useMathPopupStore } from "@/stores/mathPopupStore";

/**
 * NodeView for inline math rendering.
 * Displays KaTeX-rendered math with the source stored as an attribute.
 */
class MathInlineAtomView implements NodeView {
  dom: HTMLElement;
  private renderToken = 0;
  private getPos: (() => number | undefined) | null;
  private currentLatex: string;

  constructor(node: PMNode, getPos?: () => number | undefined) {
    this.dom = document.createElement("span");
    this.dom.className = "math-inline";
    this.dom.dataset.type = "math_inline";
    this.getPos = getPos ?? null;
    this.currentLatex = String(node.attrs.content || "");

    this.renderPreview(this.currentLatex);

    this.dom.addEventListener("click", this.handleClick);
  }

  private renderPreview(content: string): void {
    const trimmed = content.trim();
    if (!trimmed) {
      this.dom.textContent = "";
      this.dom.classList.remove("math-error");
      return;
    }

    const currentToken = ++this.renderToken;
    this.dom.textContent = trimmed;
    this.dom.classList.remove("math-error");

    // Defer KaTeX rendering to avoid blocking during document load
    const renderWithKatex = () => {
      loadKatex()
        .then((katex) => {
          if (currentToken !== this.renderToken) return;
          try {
            katex.default.render(trimmed, this.dom, {
              throwOnError: false,
              displayMode: false,
            });
          } catch {
            this.dom.textContent = trimmed;
            this.dom.classList.add("math-error");
          }
        })
        .catch(() => {
          if (currentToken !== this.renderToken) return;
          this.dom.textContent = trimmed;
          this.dom.classList.add("math-error");
        });
    };

    // Use requestIdleCallback if available, otherwise setTimeout
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(renderWithKatex, { timeout: 100 });
    } else {
      setTimeout(renderWithKatex, 0);
    }
  }

  update(node: PMNode): boolean {
    if (node.type.name !== "math_inline") return false;
    this.currentLatex = String(node.attrs.content || "");
    this.renderPreview(this.currentLatex);
    return true;
  }

  destroy(): void {
    this.dom.removeEventListener("click", this.handleClick);
  }

  private handleClick = () => {
    if (!this.getPos) return;
    const pos = this.getPos();
    if (pos === undefined) return;
    const rect = this.dom.getBoundingClientRect();
    const latex = this.currentLatex;
    useMathPopupStore.getState().openPopup(
      {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right,
      },
      latex,
      pos
    );
  };

  stopEvent(event: Event): boolean {
    if (event.type === "mousedown" || event.type === "click") {
      return true;
    }
    return false;
  }
}

/**
 * Inline math extension for Tiptap.
 *
 * Uses an atom approach: math content is stored as an attribute,
 * and the node displays rendered KaTeX output.
 */
export const mathInlineExtension = Node.create({
  name: "math_inline",
  group: "inline",
  inline: true,
  atom: true, // Atom node - no editable content inside
  selectable: true,

  addAttributes() {
    return {
      content: {
        default: "",
        parseHTML: (element) => element.textContent || "",
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="math_inline"]' }];
  },

  renderHTML({ node }) {
    return ["span", { "data-type": "math_inline", class: "math-inline" }, node.attrs.content];
  },

  addNodeView() {
    return ({ node, getPos }) => new MathInlineAtomView(node as PMNode, getPos);
  },
});
