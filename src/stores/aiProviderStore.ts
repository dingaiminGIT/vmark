/**
 * AI Provider Store
 *
 * Manages available AI providers (CLI + REST) and active selection.
 * Persists provider selection and REST API configurations.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { invoke } from "@tauri-apps/api/core";
import type {
  CliProviderInfo,
  RestProviderConfig,
  ProviderType,
  RestProviderType,
} from "@/types/aiPrompts";

// ============================================================================
// Types
// ============================================================================

interface AiProviderState {
  activeProvider: ProviderType | null;
  cliProviders: CliProviderInfo[];
  restProviders: RestProviderConfig[];
  detecting: boolean;
}

interface AiProviderActions {
  detectProviders(): Promise<void>;
  setActiveProvider(type: ProviderType): void;
  updateRestProvider(
    type: RestProviderType,
    updates: Partial<RestProviderConfig>
  ): void;
  getActiveProviderName(): string;
}

// ============================================================================
// Default REST providers
// ============================================================================

const DEFAULT_REST_PROVIDERS: RestProviderConfig[] = [
  {
    type: "anthropic",
    name: "Anthropic",
    endpoint: "https://api.anthropic.com",
    apiKey: "",
    model: "claude-sonnet-4-5-20250929",
    enabled: false,
  },
  {
    type: "openai",
    name: "OpenAI",
    endpoint: "https://api.openai.com",
    apiKey: "",
    model: "gpt-4o",
    enabled: false,
  },
  {
    type: "google-ai",
    name: "Google AI",
    endpoint: "",
    apiKey: "",
    model: "gemini-2.0-flash",
    enabled: false,
  },
  {
    type: "ollama-api",
    name: "Ollama (API)",
    endpoint: "http://localhost:11434",
    apiKey: "",
    model: "llama3.2",
    enabled: false,
  },
];

// ============================================================================
// Store
// ============================================================================

export const useAiProviderStore = create<AiProviderState & AiProviderActions>()(
  persist(
    (set, get) => ({
      activeProvider: null,
      cliProviders: [],
      restProviders: DEFAULT_REST_PROVIDERS,
      detecting: false,

      detectProviders: async () => {
        set({ detecting: true });
        try {
          type RawEntry = {
            type: string;
            name: string;
            command: string;
            available: boolean;
            path?: string;
          };
          const raw: RawEntry[] = await invoke("detect_ai_providers");
          const providers: CliProviderInfo[] = raw.map((r) => ({
            type: r.type as CliProviderInfo["type"],
            name: r.name,
            command: r.command,
            available: r.available,
            path: r.path,
          }));
          set({ cliProviders: providers, detecting: false });

          // Auto-select first available if none active
          const { activeProvider } = get();
          if (!activeProvider) {
            const first = providers.find((p) => p.available);
            if (first) {
              set({ activeProvider: first.type });
            }
          }
        } catch (e) {
          console.error("Failed to detect providers:", e);
          set({ detecting: false });
        }
      },

      setActiveProvider: (type) => {
        set({ activeProvider: type });
      },

      updateRestProvider: (type, updates) => {
        set((state) => ({
          restProviders: state.restProviders.map((p) =>
            p.type === type ? { ...p, ...updates } : p
          ),
        }));
      },

      getActiveProviderName: () => {
        const { activeProvider, cliProviders, restProviders } = get();
        if (!activeProvider) return "None";
        const cli = cliProviders.find((p) => p.type === activeProvider);
        if (cli) return cli.name;
        const rest = restProviders.find((p) => p.type === activeProvider);
        if (rest) return rest.name;
        return activeProvider;
      },
    }),
    {
      name: "vmark-ai-providers",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeProvider: state.activeProvider,
        restProviders: state.restProviders,
      }),
    }
  )
);
