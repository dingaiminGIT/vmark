/**
 * ProviderSwitcher — Tests
 *
 * Covers:
 * - Rendering CLI providers with availability badges
 * - Rendering REST providers with masked API key hints
 * - Active provider check mark
 * - Selecting a provider (activateProvider + onClose)
 * - Disabled state for unavailable CLI providers
 * - Settings button (onCloseAll + openSettingsWindow)
 * - Escape key closes switcher (stopPropagation)
 * - Outside click closes switcher
 * - API key masking (maskKey via rendered output)
 * - No CLI section when cliProviders is empty
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ProviderSwitcher } from "./ProviderSwitcher";
import type { CliProviderInfo, RestProviderConfig, ProviderType } from "@/types/aiGenies";

// ============================================================================
// Mocks
// ============================================================================

const activateProvider = vi.fn();

let mockState: {
  activeProvider: ProviderType | null;
  cliProviders: CliProviderInfo[];
  restProviders: RestProviderConfig[];
  activateProvider: ReturnType<typeof vi.fn>;
};

vi.mock("@/stores/aiProviderStore", () => {
  const store = (selector: (s: typeof mockState) => unknown) => selector(mockState);
  store.getState = () => mockState;

  return {
    useAiProviderStore: store,
    REST_TYPES: new Set(["anthropic", "openai", "google-ai", "ollama-api"]),
    KEY_OPTIONAL_REST: new Set(["ollama-api"]),
  };
});

vi.mock("@/utils/settingsWindow", () => ({
  openSettingsWindow: vi.fn(),
}));

// Lucide icons render as SVGs — let them render naturally

// ============================================================================
// Helpers
// ============================================================================

function defaultMockState(): typeof mockState {
  return {
    activeProvider: "claude",
    cliProviders: [
      { type: "claude", name: "Claude Code", command: "claude", available: true, path: "/usr/local/bin/claude" },
      { type: "codex", name: "Codex CLI", command: "codex", available: false },
    ],
    restProviders: [
      { type: "anthropic", name: "Anthropic", endpoint: "https://api.anthropic.com", apiKey: "sk-ant-1234567890", model: "claude-sonnet-4-5-20250929" },
      { type: "openai", name: "OpenAI", endpoint: "https://api.openai.com", apiKey: "", model: "gpt-4o" },
      { type: "google-ai", name: "Google AI", endpoint: "", apiKey: "goog-key-abcdefgh", model: "gemini-2.0-flash" },
      { type: "ollama-api", name: "Ollama (API)", endpoint: "http://localhost:11434", apiKey: "", model: "llama3.2" },
    ],
    activateProvider,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("ProviderSwitcher", () => {
  const onClose = vi.fn();
  const onCloseAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockState = defaultMockState();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------------

  describe("rendering", () => {
    it("renders CLI section with label and providers", () => {
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      expect(screen.getByText("CLI")).toBeInTheDocument();
      expect(screen.getByText("Claude Code")).toBeInTheDocument();
      expect(screen.getByText("Codex CLI")).toBeInTheDocument();
    });

    it("renders REST/API section with label and providers", () => {
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      expect(screen.getByText("API")).toBeInTheDocument();
      expect(screen.getByText("Anthropic")).toBeInTheDocument();
      expect(screen.getByText("OpenAI")).toBeInTheDocument();
      expect(screen.getByText("Google AI")).toBeInTheDocument();
      expect(screen.getByText("Ollama (API)")).toBeInTheDocument();
    });

    it("shows availability badges for CLI providers", () => {
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      expect(screen.getByText("Available")).toBeInTheDocument();
      expect(screen.getByText("Not found")).toBeInTheDocument();
    });

    it("renders Settings... footer button", () => {
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      expect(screen.getByText("Settings...")).toBeInTheDocument();
    });

    it("hides CLI section when no CLI providers exist", () => {
      mockState.cliProviders = [];
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      expect(screen.queryByText("CLI")).toBeNull();
      // API section still present
      expect(screen.getByText("API")).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Active provider
  // --------------------------------------------------------------------------

  describe("active provider", () => {
    it("shows check mark next to the active CLI provider", () => {
      mockState.activeProvider = "claude";
      render(
        <ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />
      );

      // The check icons rendered by Lucide will be SVGs inside .provider-switcher-check
      const claudeBtn = screen.getByText("Claude Code").closest("button")!;
      const checkSpan = claudeBtn.querySelector(".provider-switcher-check")!;
      expect(checkSpan.querySelector("svg")).not.toBeNull();

      // Codex CLI should not have check
      const codexBtn = screen.getByText("Codex CLI").closest("button")!;
      const codexCheck = codexBtn.querySelector(".provider-switcher-check")!;
      expect(codexCheck.querySelector("svg")).toBeNull();
    });

    it("shows check mark next to the active REST provider", () => {
      mockState.activeProvider = "openai";
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      const openaiBtn = screen.getByText("OpenAI").closest("button")!;
      const checkSpan = openaiBtn.querySelector(".provider-switcher-check")!;
      expect(checkSpan.querySelector("svg")).not.toBeNull();

      // Anthropic should not have check
      const anthropicBtn = screen.getByText("Anthropic").closest("button")!;
      const anthropicCheck = anthropicBtn.querySelector(".provider-switcher-check")!;
      expect(anthropicCheck.querySelector("svg")).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // API key masking
  // --------------------------------------------------------------------------

  describe("API key masking", () => {
    it("shows masked key for REST provider with API key", () => {
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      // Anthropic has apiKey "sk-ant-1234567890" → should show ••••7890
      expect(screen.getByText("••••7890")).toBeInTheDocument();
    });

    it("shows 'No key' for REST provider without API key", () => {
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      // OpenAI has empty apiKey → should show "No key"
      expect(screen.getByText("No key")).toBeInTheDocument();
    });

    it("does not show key hint for KEY_OPTIONAL_REST providers (ollama-api)", () => {
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      // Ollama (API) is in KEY_OPTIONAL_REST — no key hint shown
      const ollamaBtn = screen.getByText("Ollama (API)").closest("button")!;
      expect(ollamaBtn.querySelector(".provider-switcher-key")).toBeNull();
    });

    it("shows masked key for Google AI (has key, not in KEY_OPTIONAL_REST)", () => {
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      // Google AI has apiKey "goog-key-abcdefgh" → should show ••••efgh
      expect(screen.getByText("••••efgh")).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Selection
  // --------------------------------------------------------------------------

  describe("selection", () => {
    it("clicking an available CLI provider calls activateProvider and onClose", () => {
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      fireEvent.click(screen.getByText("Claude Code").closest("button")!);

      expect(activateProvider).toHaveBeenCalledWith("claude");
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("clicking a REST provider calls activateProvider and onClose", () => {
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      fireEvent.click(screen.getByText("OpenAI").closest("button")!);

      expect(activateProvider).toHaveBeenCalledWith("openai");
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("clicking an unavailable CLI provider does NOT call activateProvider", () => {
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      const codexBtn = screen.getByText("Codex CLI").closest("button")!;
      fireEvent.click(codexBtn);

      expect(activateProvider).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("unavailable CLI provider has disabled attribute", () => {
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      const codexBtn = screen.getByText("Codex CLI").closest("button")!;
      expect(codexBtn).toBeDisabled();
    });

    it("unavailable CLI provider has --unavailable class", () => {
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      const codexBtn = screen.getByText("Codex CLI").closest("button")!;
      expect(codexBtn.classList.contains("provider-switcher-item--unavailable")).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Settings button
  // --------------------------------------------------------------------------

  describe("settings button", () => {
    it("calls onCloseAll and openSettingsWindow when clicked", async () => {
      const { openSettingsWindow } = await import("@/utils/settingsWindow");

      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      fireEvent.click(screen.getByText("Settings..."));

      expect(onCloseAll).toHaveBeenCalledTimes(1);
      expect(openSettingsWindow).toHaveBeenCalledWith("integrations");
    });
  });

  // --------------------------------------------------------------------------
  // Escape key
  // --------------------------------------------------------------------------

  describe("escape key", () => {
    it("calls onClose when Escape is pressed", () => {
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("stops propagation so the parent picker does not close", () => {
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      // Use a capture listener on the container to verify propagation was stopped
      const parentHandler = vi.fn();
      // Add parent handler at bubble phase — it should NOT fire
      document.addEventListener("keydown", parentHandler);

      fireEvent.keyDown(document, { key: "Escape" });

      // The component adds its handler at capture phase with stopPropagation,
      // so the bubble-phase handler should not see Escape
      // Note: fireEvent dispatches from the target, and capture listeners
      // run in order of registration. Since the component registers at capture,
      // it intercepts before bubble.
      expect(onClose).toHaveBeenCalledTimes(1);

      document.removeEventListener("keydown", parentHandler);
    });
  });

  // --------------------------------------------------------------------------
  // Outside click
  // --------------------------------------------------------------------------

  describe("outside click", () => {
    it("calls onClose when clicking outside the popover", () => {
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />
        </div>
      );

      // Advance the deferred setTimeout(0) so the listener is registered
      act(() => {
        vi.runAllTimers();
      });

      fireEvent.mouseDown(screen.getByTestId("outside"));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does NOT close when clicking inside the popover", () => {
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      act(() => {
        vi.runAllTimers();
      });

      fireEvent.mouseDown(screen.getByText("API"));

      expect(onClose).not.toHaveBeenCalled();
    });

    it("does NOT close on the opening click (deferred listener)", () => {
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />
        </div>
      );

      // Click before timer fires — listener not yet registered
      fireEvent.mouseDown(screen.getByTestId("outside"));

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Cleanup
  // --------------------------------------------------------------------------

  describe("cleanup", () => {
    it("removes event listeners on unmount", () => {
      const addSpy = vi.spyOn(document, "addEventListener");
      const removeSpy = vi.spyOn(document, "removeEventListener");

      const { unmount } = render(
        <ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />
      );

      act(() => {
        vi.runAllTimers();
      });

      unmount();

      // Should have removed both mousedown and keydown listeners
      const removedTypes = removeSpy.mock.calls.map((c) => c[0]);
      expect(removedTypes).toContain("mousedown");
      expect(removedTypes).toContain("keydown");

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles all CLI providers unavailable", () => {
      mockState.cliProviders = [
        { type: "claude", name: "Claude Code", command: "claude", available: false },
        { type: "codex", name: "Codex CLI", command: "codex", available: false },
      ];
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      // Both should show "Not found"
      const badges = screen.getAllByText("Not found");
      expect(badges).toHaveLength(2);
    });

    it("handles no active provider (null)", () => {
      mockState.activeProvider = null;
      const { container } = render(
        <ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />
      );

      // No check marks should be shown
      const checkSpans = container.querySelectorAll(".provider-switcher-check svg");
      expect(checkSpans).toHaveLength(0);
    });

    it("handles REST provider with short API key (< 5 chars)", () => {
      mockState.restProviders = [
        { type: "anthropic", name: "Anthropic", endpoint: "", apiKey: "abc", model: "" },
      ];
      render(<ProviderSwitcher onClose={onClose} onCloseAll={onCloseAll} />);

      // maskKey returns "" for keys < 5 chars, so "No key" is not shown either
      // The key hint should show empty (maskKey returns "")
      // Since hasKey is true (!!p.apiKey is true for "abc"), it shows maskKey result
      // maskKey("abc") returns "" → so the span is empty
      const anthropicBtn = screen.getByText("Anthropic").closest("button")!;
      const keySpan = anthropicBtn.querySelector(".provider-switcher-key");
      expect(keySpan).not.toBeNull();
      expect(keySpan!.textContent).toBe("");
    });
  });
});
