import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { renderLatex } from "../latex";
import { renderMermaid, updateMermaidTheme } from "../mermaid";
import { sanitizeKatex, sanitizeSvg } from "@/utils/sanitize";

const codePreviewPluginKey = new PluginKey("codePreview");

const renderCache = new Map<string, string>();

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

function createPreviewElement(language: string, rendered: string): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = `code-block-preview ${language}-preview`;
  const sanitized = language === "mermaid" ? sanitizeSvg(rendered) : sanitizeKatex(rendered);
  wrapper.innerHTML = sanitized;
  return wrapper;
}

export const codePreviewExtension = Extension.create({
  name: "codePreview",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: codePreviewPluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, decorations, _oldState, newState) {
            if (!tr.docChanged && decorations !== DecorationSet.empty) {
              return decorations.map(tr.mapping, tr.doc);
            }

            const newDecorations: Decoration[] = [];

            newState.doc.descendants((node, pos) => {
              if (node.type.name !== "codeBlock" && node.type.name !== "code_block") return;

              const language = (node.attrs.language ?? "").toLowerCase();
              if (language !== "latex" && language !== "mermaid") return;

              const content = node.textContent;
              if (!content.trim()) return;

              const cacheKey = `${language}:${content}`;

              if (renderCache.has(cacheKey)) {
                const rendered = renderCache.get(cacheKey)!;
                const widget = Decoration.widget(
                  pos + node.nodeSize,
                  () => createPreviewElement(language, rendered),
                  { side: 1, key: cacheKey }
                );
                newDecorations.push(widget);
                return;
              }

              if (language === "latex") {
                const rendered = renderLatex(content);
                renderCache.set(cacheKey, rendered);
                const widget = Decoration.widget(
                  pos + node.nodeSize,
                  () => createPreviewElement(language, rendered),
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
                  pos + node.nodeSize,
                  () => {
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

            return DecorationSet.create(newState.doc, newDecorations);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

export function clearPreviewCache() {
  renderCache.clear();
}

