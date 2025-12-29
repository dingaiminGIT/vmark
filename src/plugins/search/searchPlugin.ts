/**
 * ProseMirror Search Plugin
 *
 * Provides search highlighting for the WYSIWYG editor.
 * Subscribes to searchStore and creates decorations for matches.
 */

import { $prose } from "@milkdown/kit/utils";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import { useSearchStore } from "@/stores/searchStore";
import "./search.css";

export const searchPluginKey = new PluginKey("search");

interface Match {
  from: number;
  to: number;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Find matches with ProseMirror document positions
function findMatchesInDoc(
  doc: ProseMirrorNode,
  query: string,
  caseSensitive: boolean,
  wholeWord: boolean
): Match[] {
  if (!query) return [];

  const matches: Match[] = [];
  const flags = caseSensitive ? "g" : "gi";

  let pattern = escapeRegExp(query);
  if (wholeWord) {
    pattern = `\\b${pattern}\\b`;
  }

  const regex = new RegExp(pattern, flags);

  // Walk through document to find text positions
  let textOffset = 0;
  const posMap: number[] = []; // textOffset -> docPos

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        posMap[textOffset + i] = pos + i;
      }
      textOffset += node.text.length;
    }
  });

  // Find matches in text content
  const text = doc.textContent;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const from = posMap[match.index];
    const to = posMap[match.index + match[0].length - 1];

    if (from !== undefined && to !== undefined) {
      matches.push({ from, to: to + 1 });
    }

    if (match[0].length === 0) regex.lastIndex++;
  }

  return matches;
}

export const searchPlugin = $prose(() => {
  let lastQuery = "";
  let lastCaseSensitive = false;
  let lastWholeWord = false;
  let matches: Match[] = [];

  return new Plugin({
    key: searchPluginKey,

    state: {
      init() {
        return { matches: [] as Match[], currentIndex: -1 };
      },
      apply(tr, _value) {
        // Check if search state changed
        const state = useSearchStore.getState();
        const queryChanged =
          state.query !== lastQuery ||
          state.caseSensitive !== lastCaseSensitive ||
          state.wholeWord !== lastWholeWord;

        if (queryChanged || tr.docChanged) {
          lastQuery = state.query;
          lastCaseSensitive = state.caseSensitive;
          lastWholeWord = state.wholeWord;

          // Find matches in document
          matches = findMatchesInDoc(
            tr.doc,
            state.query,
            state.caseSensitive,
            state.wholeWord
          );

          // Update store with match count
          useSearchStore.getState().setMatches(matches.length, matches.length > 0 ? 0 : -1);
        }

        const currentIndex = useSearchStore.getState().currentIndex;
        return { matches, currentIndex };
      },
    },

    props: {
      decorations(state) {
        const searchState = useSearchStore.getState();
        if (!searchState.isOpen || !searchState.query) {
          return DecorationSet.empty;
        }

        const pluginState = searchPluginKey.getState(state);
        if (!pluginState || pluginState.matches.length === 0) {
          return DecorationSet.empty;
        }

        const decorations = pluginState.matches.map((match: Match, i: number) => {
          const isActive = i === pluginState.currentIndex;
          return Decoration.inline(match.from, match.to, {
            class: isActive ? "search-match search-match-active" : "search-match",
          });
        });

        return DecorationSet.create(state.doc, decorations);
      },
    },

    view(editorView) {
      // Scroll current match into view when it changes
      let lastScrolledIndex = -1;

      const scrollToMatch = () => {
        const state = useSearchStore.getState();
        if (!state.isOpen || state.currentIndex < 0) return;
        if (state.currentIndex === lastScrolledIndex) return;

        const pluginState = searchPluginKey.getState(editorView.state);
        if (!pluginState || !pluginState.matches[state.currentIndex]) return;

        const match = pluginState.matches[state.currentIndex];
        lastScrolledIndex = state.currentIndex;

        // Scroll the match into view
        const coords = editorView.coordsAtPos(match.from);
        const editorRect = editorView.dom.getBoundingClientRect();

        if (coords.top < editorRect.top || coords.bottom > editorRect.bottom) {
          editorView.dom.scrollTo({
            top: editorView.dom.scrollTop + coords.top - editorRect.top - editorRect.height / 3,
            behavior: "smooth",
          });
        }
      };

      // Subscribe to store changes
      const unsubscribe = useSearchStore.subscribe(() => {
        editorView.dispatch(editorView.state.tr);
        requestAnimationFrame(scrollToMatch);
      });

      return {
        destroy() {
          unsubscribe();
        },
      };
    },
  });
});

export default searchPlugin;
