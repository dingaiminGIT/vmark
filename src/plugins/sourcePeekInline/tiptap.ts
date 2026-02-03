/**
 * Inline Source Peek Plugin
 *
 * Provides inline split view for editing markdown source of ProseMirror blocks.
 * Uses decorations to insert a CodeMirror editor above the block being edited.
 *
 * Architecture:
 * - Header widget (block type label, cancel/save buttons)
 * - CodeMirror widget (markdown source editor)
 * - Node decoration (dims the preview block)
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { EditorState as CMState } from "@codemirror/state";
import { EditorView as CMView, keymap as cmKeymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown as markdownLang } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting } from "@codemirror/language";
import { useSourcePeekStore } from "@/stores/sourcePeekStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUnifiedHistoryStore } from "@/stores/unifiedHistoryStore";
import { useTabStore } from "@/stores/tabStore";
import { useDocumentStore } from "@/stores/documentStore";
import { applySourcePeekMarkdown, serializeSourcePeekRange, getExpandedSourcePeekRange } from "@/utils/sourcePeek";
import { codeHighlightStyle } from "@/plugins/codemirror";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { resolveHardBreakStyle } from "@/utils/linebreaks";

const sourcePeekInlinePluginKey = new PluginKey("sourcePeekInline");

/** Meta key to signal editing state changes */
const EDITING_STATE_CHANGED = "sourcePeekEditingChanged";

/**
 * Block types that should NOT use Source Peek.
 * These have their own editing mechanisms or no editable content.
 */
const SOURCE_PEEK_EXCLUDED_TYPES = new Set([
  "codeBlock",
  "code_block",
  "block_image",
  "frontmatter",
  "html_block",
  "horizontalRule",
]);

/** Track CodeMirror view for cleanup */
let currentCMView: CMView | null = null;

/**
 * Get block type label for display in header.
 */
function getBlockTypeLabel(typeName: string): string {
  const labels: Record<string, string> = {
    paragraph: "Paragraph",
    heading: "Heading",
    codeBlock: "Code Block",
    code_block: "Code Block",
    blockquote: "Blockquote",
    bulletList: "Bullet List",
    orderedList: "Numbered List",
    taskList: "Task List",
    table: "Table",
    detailsBlock: "Details",
    horizontalRule: "Divider",
    image: "Image",
  };
  return labels[typeName] ?? typeName.replace(/([A-Z])/g, " $1").trim();
}

/**
 * Create header element with block type label and action buttons.
 */
function createEditHeader(
  blockTypeName: string,
  hasChanges: boolean,
  onCancel: () => void,
  onSave: () => void,
  onToggleLive: () => void,
  livePreview: boolean
): HTMLElement {
  const header = document.createElement("div");
  header.className = `source-peek-inline-header${hasChanges ? " has-changes" : ""}`;

  const title = document.createElement("div");
  title.className = "source-peek-inline-title";
  title.textContent = "Source Peek";

  const blockType = document.createElement("span");
  blockType.className = "source-peek-inline-block-type";
  blockType.textContent = getBlockTypeLabel(blockTypeName);
  title.appendChild(blockType);

  const actions = document.createElement("div");
  actions.className = "source-peek-inline-actions";

  // Hint text
  const hint = document.createElement("span");
  hint.className = "source-peek-inline-hint";
  hint.textContent = "⌘↵ save · ⎋ cancel";

  // Live preview toggle
  const liveBtn = document.createElement("button");
  liveBtn.className = `source-peek-inline-btn source-peek-inline-btn--live${livePreview ? " active" : ""}`;
  liveBtn.title = "Toggle live preview";
  liveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  liveBtn.addEventListener("mousedown", (e) => e.preventDefault());
  liveBtn.addEventListener("click", (e) => {
    e.preventDefault();
    onToggleLive();
  });

  // Cancel button
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "source-peek-inline-btn source-peek-inline-btn--cancel";
  cancelBtn.title = "Cancel (Esc)";
  cancelBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  cancelBtn.addEventListener("mousedown", (e) => e.preventDefault());
  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    onCancel();
  });

  // Save button
  const saveBtn = document.createElement("button");
  saveBtn.className = "source-peek-inline-btn source-peek-inline-btn--save";
  saveBtn.title = "Save (⌘+Enter)";
  saveBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  saveBtn.addEventListener("mousedown", (e) => e.preventDefault());
  saveBtn.addEventListener("click", (e) => {
    e.preventDefault();
    onSave();
  });

  actions.appendChild(hint);
  actions.appendChild(liveBtn);
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);

  header.appendChild(title);
  header.appendChild(actions);

  return header;
}

/**
 * Create CodeMirror editor element.
 */
function createCodeMirrorEditor(
  markdown: string,
  view: EditorView,
  onUpdate: (markdown: string) => void
): HTMLElement {
  const container = document.createElement("div");
  container.className = "source-peek-inline-editor";

  const theme = CMView.theme({
    "&": {
      height: "100%",
    },
    ".cm-content": {
      fontFamily: "var(--font-mono, monospace)",
      fontSize: "13px",
      lineHeight: "1.5",
      padding: "0",
    },
    ".cm-line": {
      padding: "0",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "var(--selection-color, rgba(0, 122, 255, 0.2)) !important",
    },
  });

  const handleSave = () => {
    commitSourcePeek(view);
    return true;
  };

  const handleCancel = () => {
    revertAndCloseSourcePeek(view);
    return true;
  };

  const state = CMState.create({
    doc: markdown,
    extensions: [
      CMView.lineWrapping,
      history(),
      cmKeymap.of([
        { key: "Mod-Enter", run: handleSave },
        { key: "Escape", run: handleCancel },
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      CMView.updateListener.of((update) => {
        if (update.docChanged) {
          onUpdate(update.state.doc.toString());
        }
      }),
      markdownLang({ codeLanguages: languages }),
      syntaxHighlighting(codeHighlightStyle, { fallback: true }),
      theme,
    ],
  });

  // Cleanup previous CM view
  if (currentCMView) {
    currentCMView.destroy();
  }

  const cmView = new CMView({
    state,
    parent: container,
  });

  currentCMView = cmView;

  // Focus after render
  requestAnimationFrame(() => {
    cmView.focus();
  });

  return container;
}

/**
 * Create preview label.
 */
function createPreviewLabel(): HTMLElement {
  const label = document.createElement("div");
  label.className = "source-peek-inline-preview-label";
  label.textContent = "Preview";
  return label;
}

/**
 * Get current tab ID for unified history.
 */
function getCurrentTabId(): string | null {
  const windowLabel = getCurrentWebviewWindow().label;
  return useTabStore.getState().activeTabId[windowLabel] ?? null;
}

/**
 * Get markdown pipeline options.
 */
function getMarkdownOptions() {
  const settings = useSettingsStore.getState();
  const tabId = getCurrentTabId();
  const doc = tabId ? useDocumentStore.getState().getDocument(tabId) : null;
  return {
    preserveLineBreaks: settings.markdown.preserveLineBreaks,
    hardBreakStyle: resolveHardBreakStyle(
      doc?.hardBreakStyle ?? "unknown",
      settings.markdown.hardBreakStyleOnSave
    ),
  };
}

/**
 * Check if a block type should use Source Peek.
 * Returns false for blocks with their own editing mechanisms.
 */
export function canUseSourcePeek(typeName: string): boolean {
  return !SOURCE_PEEK_EXCLUDED_TYPES.has(typeName);
}

/**
 * Open Source Peek for editing the block at cursor.
 * Creates a checkpoint in unified history for revert.
 * Returns false if the block type is excluded from Source Peek.
 */
export function openSourcePeekInline(view: EditorView): boolean {
  const range = getExpandedSourcePeekRange(view.state);

  // Get block type name for header
  const node = view.state.doc.nodeAt(range.from);
  const blockTypeName = node?.type.name ?? "unknown";

  // Skip excluded block types
  if (!canUseSourcePeek(blockTypeName)) {
    return false;
  }

  const options = getMarkdownOptions();
  const markdown = serializeSourcePeekRange(view.state, range, options);

  // Create checkpoint in unified history
  const tabId = getCurrentTabId();
  if (tabId) {
    const docContent = useDocumentStore.getState().getDocument(tabId)?.content ?? "";
    useUnifiedHistoryStore.getState().createCheckpoint(tabId, {
      markdown: docContent,
      mode: "wysiwyg",
      cursorInfo: null,
    });
  }

  // Open the store
  useSourcePeekStore.getState().open({
    markdown,
    range,
    blockTypeName,
  });

  // Dispatch to trigger decoration rebuild
  const tr = view.state.tr.setMeta(EDITING_STATE_CHANGED, true);
  view.dispatch(tr);

  return true;
}

/**
 * Commit changes and close Source Peek.
 */
export function commitSourcePeek(view: EditorView): void {
  const store = useSourcePeekStore.getState();
  const { markdown, range, originalMarkdown } = store;

  if (!range) return;

  // Check for empty content
  if (markdown.trim() === "") {
    // Create empty paragraph instead
    const paragraphType = view.state.schema.nodes.paragraph;
    if (paragraphType) {
      const emptyParagraph = paragraphType.create();
      const tr = view.state.tr.replaceWith(range.from, range.to, emptyParagraph);
      tr.setSelection(TextSelection.near(tr.doc.resolve(range.from)));
      tr.setMeta(EDITING_STATE_CHANGED, true);
      view.dispatch(tr);
    }
    store.close();
    cleanupCMView();
    view.focus();
    return;
  }

  // Only apply if content changed
  if (markdown !== originalMarkdown) {
    const options = getMarkdownOptions();
    applySourcePeekMarkdown(view, range, markdown, options);
  }

  store.close();
  cleanupCMView();

  // Dispatch to trigger decoration removal
  const tr = view.state.tr.setMeta(EDITING_STATE_CHANGED, true);
  view.dispatch(tr);

  view.focus();
}

/**
 * Revert to original content and close Source Peek.
 */
export function revertAndCloseSourcePeek(view: EditorView): void {
  const store = useSourcePeekStore.getState();

  // Just close - no changes applied
  store.close();
  cleanupCMView();

  // Dispatch to trigger decoration removal
  const tr = view.state.tr.setMeta(EDITING_STATE_CHANGED, true);
  view.dispatch(tr);

  view.focus();
}

/**
 * Cleanup CodeMirror view.
 */
function cleanupCMView(): void {
  if (currentCMView) {
    currentCMView.destroy();
    currentCMView = null;
  }
}

interface SourcePeekPluginState {
  decorations: DecorationSet;
  editingPos: number | null;
}

export const sourcePeekInlineExtension = Extension.create({
  name: "sourcePeekInline",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: sourcePeekInlinePluginKey,
        state: {
          init(): SourcePeekPluginState {
            return { decorations: DecorationSet.empty, editingPos: null };
          },
          apply(tr, state, _oldState, newState): SourcePeekPluginState {
            const store = useSourcePeekStore.getState();
            const { isOpen, range, markdown, blockTypeName, hasUnsavedChanges, livePreview } = store;

            const editingChanged = tr.getMeta(EDITING_STATE_CHANGED);
            const currentEditingPos = isOpen && range ? range.from : null;

            // If not editing or no changes, map decorations
            if (!isOpen || !range) {
              cleanupCMView();
              return { decorations: DecorationSet.empty, editingPos: null };
            }

            // Only rebuild decorations if editing state changed
            if (!editingChanged && state.editingPos === currentEditingPos && state.decorations !== DecorationSet.empty) {
              return {
                decorations: state.decorations.map(tr.mapping, tr.doc),
                editingPos: currentEditingPos,
              };
            }

            const decorations: Decoration[] = [];
            const nodeStart = range.from;
            const node = newState.doc.nodeAt(nodeStart);
            if (!node) {
              return { decorations: DecorationSet.empty, editingPos: null };
            }

            const nodeEnd = nodeStart + node.nodeSize;

            // Create wrapper widget that contains header + editor
            const wrapperWidget = Decoration.widget(
              nodeStart,
              (view) => {
                const wrapper = document.createElement("div");
                wrapper.className = "source-peek-inline";

                // Header
                const header = createEditHeader(
                  blockTypeName ?? node.type.name,
                  hasUnsavedChanges,
                  () => revertAndCloseSourcePeek(view),
                  () => commitSourcePeek(view),
                  () => {
                    useSourcePeekStore.getState().toggleLivePreview();
                    // Rebuild decorations
                    const tr = view.state.tr.setMeta(EDITING_STATE_CHANGED, true);
                    view.dispatch(tr);
                  },
                  livePreview
                );
                wrapper.appendChild(header);

                // CodeMirror editor
                const editor = createCodeMirrorEditor(
                  markdown,
                  view,
                  (newMarkdown) => {
                    useSourcePeekStore.getState().setMarkdown(newMarkdown);

                    // Live preview: apply changes immediately
                    if (useSourcePeekStore.getState().livePreview) {
                      const currentRange = useSourcePeekStore.getState().range;
                      if (currentRange) {
                        const options = getMarkdownOptions();
                        applySourcePeekMarkdown(view, currentRange, newMarkdown, options);
                        // Update range after apply (content may have changed size)
                        const newRange = getExpandedSourcePeekRange(view.state);
                        useSourcePeekStore.setState({ range: newRange });
                      }
                    }
                  }
                );
                wrapper.appendChild(editor);

                // Preview label (the actual preview is the node itself)
                const previewLabel = createPreviewLabel();
                wrapper.appendChild(previewLabel);

                return wrapper;
              },
              { side: -1, key: `source-peek:${nodeStart}` }
            );
            decorations.push(wrapperWidget);

            // Mark the node as being edited (dims it in CSS)
            decorations.push(
              Decoration.node(nodeStart, nodeEnd, {
                class: "source-peek-editing",
              })
            );

            return {
              decorations: DecorationSet.create(newState.doc, decorations),
              editingPos: currentEditingPos,
            };
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
        view() {
          return {
            destroy() {
              cleanupCMView();
            },
          };
        },
      }),
    ];
  },
});

export { sourcePeekInlinePluginKey, EDITING_STATE_CHANGED };
