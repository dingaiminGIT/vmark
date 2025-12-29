import { useEffect, useRef } from "react";
import { EditorState, Compartment, RangeSetBuilder } from "@codemirror/state";
import {
  EditorView,
  keymap,
  drawSelection,
  dropCursor,
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import {
  search,
  selectNextOccurrence,
  selectSelectionMatches,
  setSearchQuery,
  SearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll,
} from "@codemirror/search";
import { useEditorStore } from "@/stores/editorStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSearchStore } from "@/stores/searchStore";
import {
  getCursorInfoFromCodeMirror,
  restoreCursorInCodeMirror,
} from "@/utils/cursorSync/codemirror";

// Compartment for dynamic line wrapping
const lineWrapCompartment = new Compartment();
// Compartment for br tag visibility
const brVisibilityCompartment = new Compartment();

// Decoration to hide <br /> lines
const hiddenLineDecoration = Decoration.line({ class: "cm-br-hidden" });

// Plugin to find and decorate <br /> lines
function createBrHidingPlugin(hide: boolean) {
  if (!hide) return [];

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      buildDecorations(view: EditorView) {
        const builder = new RangeSetBuilder<Decoration>();
        const doc = view.state.doc;

        for (let i = 1; i <= doc.lines; i++) {
          const line = doc.line(i);
          // Match lines that are just <br /> (with optional whitespace)
          if (/^\s*<br\s*\/?>\s*$/.test(line.text)) {
            builder.add(line.from, line.from, hiddenLineDecoration);
          }
        }

        return builder.finish();
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );
}

export function SourceEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isInternalChange = useRef(false);

  const content = useEditorStore((state) => state.content);
  const wordWrap = useEditorStore((state) => state.wordWrap);
  const showBrTags = useSettingsStore((state) => state.markdown.showBrTags);

  // Create CodeMirror instance
  useEffect(() => {
    if (!containerRef.current || viewRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        isInternalChange.current = true;
        const newContent = update.state.doc.toString();
        useEditorStore.getState().setContent(newContent);
        requestAnimationFrame(() => {
          isInternalChange.current = false;
        });
      }
      // Track cursor position for mode sync
      if (update.selectionSet || update.docChanged) {
        const cursorInfo = getCursorInfoFromCodeMirror(update.view);
        useEditorStore.getState().setCursorInfo(cursorInfo);
      }
    });

    const initialWordWrap = useEditorStore.getState().wordWrap;
    const initialShowBrTags = useSettingsStore.getState().markdown.showBrTags;

    const state = EditorState.create({
      doc: content,
      extensions: [
        // Line wrapping (dynamic via compartment)
        lineWrapCompartment.of(initialWordWrap ? EditorView.lineWrapping : []),
        // BR visibility (dynamic via compartment) - hide when showBrTags is false
        brVisibilityCompartment.of(createBrHidingPlugin(!initialShowBrTags)),
        // Multi-cursor support
        drawSelection(),
        dropCursor(),
        // History (undo/redo)
        history(),
        // Keymaps (no searchKeymap - we use our unified FindBar)
        keymap.of([
          // Cmd+D: select next occurrence
          { key: "Mod-d", run: selectNextOccurrence, preventDefault: true },
          // Cmd+Shift+L: select all occurrences
          { key: "Mod-Shift-l", run: selectSelectionMatches, preventDefault: true },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        // Search extension (programmatic control only, no panel)
        search(),
        // Markdown syntax
        markdown(),
        // Listen for changes
        updateListener,
        // Theme/styling
        EditorView.theme({
          "&": {
            fontSize: "18px",
            height: "100%",
          },
          ".cm-content": {
            fontFamily: "var(--font-sans)",
            lineHeight: "1.8",
            caretColor: "var(--text-color)",
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
          ".cm-cursor": {
            borderLeftColor: "var(--text-color)",
            borderLeftWidth: "2px",
          },
          // Secondary cursors for multi-cursor
          ".cm-cursor-secondary": {
            borderLeftColor: "var(--primary-color)",
            borderLeftWidth: "2px",
          },
        }),
        // Allow multiple selections
        EditorState.allowMultipleSelections.of(true),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Auto-focus and restore cursor on mount
    setTimeout(() => {
      view.focus();
      // Restore cursor position from previous mode if available
      const cursorInfo = useEditorStore.getState().cursorInfo;
      if (cursorInfo) {
        restoreCursorInCodeMirror(view, cursorInfo);
      }
    }, 50);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external content changes to CodeMirror
  useEffect(() => {
    const view = viewRef.current;
    if (!view || isInternalChange.current) return;

    const currentContent = view.state.doc.toString();
    if (currentContent !== content) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: content,
        },
      });
    }
  }, [content]);

  // Update line wrapping when wordWrap changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: lineWrapCompartment.reconfigure(
        wordWrap ? EditorView.lineWrapping : []
      ),
    });
  }, [wordWrap]);

  // Update br visibility when showBrTags changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: brVisibilityCompartment.reconfigure(
        createBrHidingPlugin(!showBrTags)
      ),
    });
  }, [showBrTags]);

  // Subscribe to searchStore for programmatic search
  useEffect(() => {
    const unsubscribe = useSearchStore.subscribe((state, prevState) => {
      const view = viewRef.current;
      if (!view) return;

      // Update search query when it changes
      if (
        state.query !== prevState.query ||
        state.caseSensitive !== prevState.caseSensitive ||
        state.wholeWord !== prevState.wholeWord
      ) {
        if (state.query) {
          const query = new SearchQuery({
            search: state.query,
            caseSensitive: state.caseSensitive,
            wholeWord: state.wholeWord,
          });
          view.dispatch({ effects: setSearchQuery.of(query) });
        } else {
          // Clear search
          view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: "" })) });
        }
      }

      // Handle find next/previous
      if (state.currentIndex !== prevState.currentIndex && state.currentIndex >= 0) {
        const direction = state.currentIndex > prevState.currentIndex ? 1 : -1;
        if (direction > 0) {
          findNext(view);
        } else {
          findPrevious(view);
        }
      }

      // Handle replace
      if (state.replaceText !== prevState.replaceText && state.isOpen && state.showReplace) {
        const query = new SearchQuery({
          search: state.query,
          replace: state.replaceText,
          caseSensitive: state.caseSensitive,
          wholeWord: state.wholeWord,
        });
        view.dispatch({ effects: setSearchQuery.of(query) });
      }
    });

    // Handle replace actions via custom events
    const handleReplaceCurrent = () => {
      const view = viewRef.current;
      if (view) replaceNext(view);
    };

    const handleReplaceAll = () => {
      const view = viewRef.current;
      if (view) replaceAll(view);
    };

    window.addEventListener("search:replace-current", handleReplaceCurrent);
    window.addEventListener("search:replace-all", handleReplaceAll);

    return () => {
      unsubscribe();
      window.removeEventListener("search:replace-current", handleReplaceCurrent);
      window.removeEventListener("search:replace-all", handleReplaceAll);
    };
  }, []);

  return <div ref={containerRef} className="source-editor" />;
}

export default SourceEditor;
