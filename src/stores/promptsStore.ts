/**
 * Prompts Store
 *
 * Manages loaded AI prompt definitions from global and workspace directories.
 * Persists recent/favorite prompt names only (prompts are read from disk).
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import type { PromptDefinition, PromptMetadata, PromptScope } from "@/types/aiPrompts";

// ============================================================================
// Types
// ============================================================================

interface PromptEntry {
  name: string;
  path: string;
  source: string;
  category: string | null;
}

interface PromptContent {
  metadata: PromptMetadata;
  template: string;
}

interface PromptsState {
  prompts: PromptDefinition[];
  loading: boolean;
  recentPromptNames: string[];
  favoritePromptNames: string[];
}

interface PromptsActions {
  loadPrompts(workspaceRoot?: string | null): Promise<void>;
  searchPrompts(query: string, scope?: PromptScope | null): PromptDefinition[];
  getGroupedByCategory(): Map<string, PromptDefinition[]>;
  addRecent(name: string): void;
  toggleFavorite(name: string): void;
  isFavorite(name: string): boolean;
  getRecent(): PromptDefinition[];
}

const MAX_RECENTS = 10;

// ============================================================================
// Store
// ============================================================================

export const usePromptsStore = create<PromptsState & PromptsActions>()(
  persist(
    (set, get) => ({
      prompts: [],
      loading: false,
      recentPromptNames: [],
      favoritePromptNames: [],

      loadPrompts: async (workspaceRoot) => {
        set({ loading: true });
        try {
          const entries: PromptEntry[] = await invoke("list_prompts", {
            workspaceRoot: workspaceRoot ?? null,
          });

          const prompts: PromptDefinition[] = [];
          for (const entry of entries) {
            try {
              const content: PromptContent = await invoke("read_prompt", {
                path: entry.path,
              });
              prompts.push({
                metadata: content.metadata,
                template: content.template,
                filePath: entry.path,
                source: entry.source as "global" | "workspace",
              });
            } catch (e) {
              console.warn(`Failed to read prompt ${entry.path}:`, e);
            }
          }

          set({ prompts, loading: false });
        } catch (e) {
          console.error("Failed to load prompts:", e);
          set({ loading: false });
        }
      },

      searchPrompts: (query, scope) => {
        const { prompts } = get();
        const lower = query.toLowerCase();
        return prompts.filter((p) => {
          if (scope && p.metadata.scope !== scope) return false;
          if (!lower) return true;
          return (
            p.metadata.name.toLowerCase().includes(lower) ||
            p.metadata.description.toLowerCase().includes(lower) ||
            (p.metadata.category?.toLowerCase().includes(lower) ?? false)
          );
        });
      },

      getGroupedByCategory: () => {
        const { prompts } = get();
        const grouped = new Map<string, PromptDefinition[]>();
        for (const p of prompts) {
          const cat = p.metadata.category ?? "Uncategorized";
          const list = grouped.get(cat) ?? [];
          list.push(p);
          grouped.set(cat, list);
        }
        return grouped;
      },

      addRecent: (name) => {
        set((state) => {
          const filtered = state.recentPromptNames.filter((n) => n !== name);
          return {
            recentPromptNames: [name, ...filtered].slice(0, MAX_RECENTS),
          };
        });
      },

      toggleFavorite: (name) => {
        set((state) => {
          const isFav = state.favoritePromptNames.includes(name);
          return {
            favoritePromptNames: isFav
              ? state.favoritePromptNames.filter((n) => n !== name)
              : [...state.favoritePromptNames, name],
          };
        });
      },

      isFavorite: (name) => {
        return get().favoritePromptNames.includes(name);
      },

      getRecent: () => {
        const { prompts, recentPromptNames } = get();
        return recentPromptNames
          .map((name) => prompts.find((p) => p.metadata.name === name))
          .filter((p): p is PromptDefinition => p !== undefined);
      },
    }),
    {
      name: "vmark-prompts",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        recentPromptNames: state.recentPromptNames,
        favoritePromptNames: state.favoritePromptNames,
      }),
    }
  )
);
