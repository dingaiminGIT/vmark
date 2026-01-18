import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { renderLatex } from "../latex";
import { renderMermaid, updateMermaidTheme } from "../mermaid";
import { sanitizeKatex, sanitizeSvg } from "@/utils/sanitize";
import { useBlockMathEditingStore } from "@/stores/blockMathEditingStore";

const codePreviewPluginKey = new PluginKey("codePreview");
const PREVIEW_ONLY_LANGUAGES = new Set(["latex", "mermaid", "$$math$$"]);

/** Check if language is a latex/math language (handles both "latex" and "$$math$$" sentinel) */
function isLatexLanguage(lang: string): boolean {
  return lang === "latex" || lang === "$$math$$";
}

const renderCache = new Map<string, string>();
const renderPromises = new Map<string, Promise<string>>();

let themeObserverSetup = false;

function setupThemeObserver() {
  if (themeObserverSetup || typeof window === "undefined") return;
  themeObserverSetup = true;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === "class") {
        const isDark = document.documentElement.classList.contains("dark");
        updateMermaidTheme(isDark).then((themeChanged) => {
          if (themeChanged) {
            renderCache.clear();
          }
        });
      }
    }
  });

  observer.observe(document.documentElement, { attributes: true });
}

setupThemeObserver();

function installSelectHandlers(element: HTMLElement, onSelect?: () => void): void {
  if (!onSelect) return;
  element.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });
  element.addEventListener("click", (event) => {
    event.preventDefault();
    onSelect();
  });
}

function createPreviewElement(
  language: string,
  rendered: string,
  onSelect?: () => void
): HTMLElement {
  const wrapper = document.createElement("div");
  // Use "latex" class for both "latex" and "$$math$$" languages
  const previewClass = isLatexLanguage(language) ? "latex" : language;
  wrapper.className = `code-block-preview ${previewClass}-preview`;
  const sanitized = language === "mermaid" ? sanitizeSvg(rendered) : sanitizeKatex(rendered);
  wrapper.innerHTML = sanitized;
  installSelectHandlers(wrapper, onSelect);
  return wrapper;
}

function createPreviewPlaceholder(
  language: string,
  label: string,
  onSelect?: () => void
): HTMLElement {
  const wrapper = document.createElement("div");
  // Use "latex" class for both "latex" and "$$math$$" languages
  const previewClass = isLatexLanguage(language) ? "latex" : language;
  wrapper.className = `code-block-preview ${previewClass}-preview code-block-preview-placeholder`;
  wrapper.textContent = label;
  installSelectHandlers(wrapper, onSelect);
  return wrapper;
}

/** Meta key to signal editing state change */
const EDITING_STATE_CHANGED = "codePreviewEditingChanged";

interface CodePreviewState {
  decorations: DecorationSet;
  editingPos: number | null;
}

export const codePreviewExtension = Extension.create({
  name: "codePreview",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: codePreviewPluginKey,
        state: {
          init(): CodePreviewState {
            return { decorations: DecorationSet.empty, editingPos: null };
          },
          apply(tr, state, _oldState, newState): CodePreviewState {
            const storeEditingPos = useBlockMathEditingStore.getState().editingPos;
            const editingChanged = tr.getMeta(EDITING_STATE_CHANGED) || state.editingPos !== storeEditingPos;

            // Only recompute if doc changed or editing state changed
            if (!tr.docChanged && !editingChanged && state.decorations !== DecorationSet.empty) {
              return {
                decorations: state.decorations.map(tr.mapping, tr.doc),
                editingPos: state.editingPos,
              };
            }

            const newDecorations: Decoration[] = [];
            const currentEditingPos = storeEditingPos;

            newState.doc.descendants((node, pos) => {
              if (node.type.name !== "codeBlock" && node.type.name !== "code_block") return;

              const language = (node.attrs.language ?? "").toLowerCase();
              if (!PREVIEW_ONLY_LANGUAGES.has(language)) return;

              const content = node.textContent;
              const cacheKey = `${language}:${content}`;
              const nodeStart = pos;
              const nodeEnd = pos + node.nodeSize;

              // Check if this block is being edited
              const isEditing = currentEditingPos === nodeStart;

              if (isEditing) {
                // Add editing class, keep contenteditable
                newDecorations.push(
                  Decoration.node(nodeStart, nodeEnd, {
                    class: "code-block-editing",
                    "data-language": language,
                  })
                );
                // No widget preview when editing
                return;
              }

              const handleSelect = (view: EditorView | null | undefined) => {
                if (!view) return;
                // Enter editing mode: set cursor inside the code block
                const $pos = view.state.doc.resolve(nodeStart + 1);
                const tr = view.state.tr.setSelection(TextSelection.near($pos));
                tr.setMeta(EDITING_STATE_CHANGED, true);
                view.dispatch(tr);
                view.focus();
                // Update store
                useBlockMathEditingStore.getState().startEditing(nodeStart, content);
              };

              newDecorations.push(
                Decoration.node(nodeStart, nodeEnd, {
                  class: "code-block-preview-only",
                  "data-language": language,
                  contenteditable: "false",
                })
              );

              if (!content.trim()) {
                const placeholderLabel = language === "mermaid" ? "Empty diagram" : "Empty math block";
                const widget = Decoration.widget(
                  nodeEnd,
                  (view) => createPreviewPlaceholder(language, placeholderLabel, () => handleSelect(view)),
                  { side: 1, key: `${cacheKey}:placeholder` }
                );
                newDecorations.push(widget);
                return;
              }

              if (renderCache.has(cacheKey)) {
                const rendered = renderCache.get(cacheKey)!;
                const widget = Decoration.widget(
                  nodeEnd,
                  (view) => createPreviewElement(language, rendered, () => handleSelect(view)),
                  { side: 1, key: cacheKey }
                );
                newDecorations.push(widget);
                return;
              }

              if (isLatexLanguage(language)) {
                const placeholder = document.createElement("div");
                placeholder.className = "code-block-preview latex-preview code-block-preview-placeholder";
                placeholder.textContent = "Rendering math...";

                const widget = Decoration.widget(
                  nodeEnd,
                  (view) => {
                    installSelectHandlers(placeholder, () => handleSelect(view));

                    let promise = renderPromises.get(cacheKey);
                    if (!promise) {
                      const renderPromise = Promise.resolve(renderLatex(content));
                      renderPromises.set(cacheKey, renderPromise);
                      promise = renderPromise;
                    }

                    promise
                      .then((rendered) => {
                        renderCache.set(cacheKey, rendered);
                        renderPromises.delete(cacheKey);
                        placeholder.className = "code-block-preview latex-preview";
                        placeholder.innerHTML = sanitizeKatex(rendered);
                      })
                      .catch(() => {
                        renderPromises.delete(cacheKey);
                        placeholder.className = "code-block-preview latex-preview code-block-preview-placeholder";
                        placeholder.textContent = "Failed to render math";
                      });

                    return placeholder;
                  },
                  { side: 1, key: cacheKey }
                );

                newDecorations.push(widget);
                return;
              }

              if (language === "mermaid") {
                const placeholder = document.createElement("div");
                placeholder.className = "code-block-preview mermaid-preview mermaid-loading";
                placeholder.textContent = "Rendering diagram...";

                const widget = Decoration.widget(
                  nodeEnd,
                  (view) => {
                    placeholder.addEventListener("mousedown", (event) => {
                      event.preventDefault();
                    });
                    placeholder.addEventListener("click", (event) => {
                      event.preventDefault();
                      handleSelect(view);
                    });
                    renderMermaid(content).then((svg) => {
                      if (svg) {
                        renderCache.set(cacheKey, svg);
                        placeholder.className = "code-block-preview mermaid-preview";
                        placeholder.innerHTML = sanitizeSvg(svg);
                      } else {
                        placeholder.className = "code-block-preview mermaid-error";
                        placeholder.textContent = "Failed to render diagram";
                      }
                    });
                    return placeholder;
                  },
                  { side: 1, key: cacheKey }
                );
                newDecorations.push(widget);
              }
            });

            return {
              decorations: DecorationSet.create(newState.doc, newDecorations),
              editingPos: currentEditingPos,
            };
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

/** Export plugin key for other extensions */
export { codePreviewPluginKey, EDITING_STATE_CHANGED };

export function clearPreviewCache() {
  renderCache.clear();
}
