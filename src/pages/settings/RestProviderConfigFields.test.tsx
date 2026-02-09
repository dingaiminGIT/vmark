import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RestProviderConfigFields } from "./RestProviderConfigFields";
import { useAiProviderStore } from "@/stores/aiProviderStore";

// Mock the store — we only care about getState().updateRestProvider
vi.mock("@/stores/aiProviderStore", () => {
  const updateRestProvider = vi.fn();
  return {
    useAiProviderStore: {
      getState: () => ({ updateRestProvider }),
    },
  };
});

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock sonner toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

function getUpdateMock() {
  return useAiProviderStore.getState().updateRestProvider as ReturnType<typeof vi.fn>;
}

describe("RestProviderConfigFields", () => {
  beforeEach(() => {
    getUpdateMock().mockClear();
    mockInvoke.mockClear();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
  });

  it("renders endpoint, apiKey, and model inputs for non-google providers", () => {
    render(
      <RestProviderConfigFields
        type="anthropic"
        endpoint="https://api.anthropic.com"
        apiKey="sk-test"
        model="claude-sonnet-4-5-20250929"
      />,
    );

    expect(screen.getByPlaceholderText("API Endpoint")).toHaveValue("https://api.anthropic.com");
    expect(screen.getByPlaceholderText("API Key")).toHaveValue("sk-test");
    expect(screen.getByPlaceholderText("Model")).toHaveValue("claude-sonnet-4-5-20250929");
  });

  it("hides endpoint input for google-ai provider", () => {
    render(
      <RestProviderConfigFields
        type="google-ai"
        endpoint=""
        apiKey="goog-key"
        model="gemini-2.0-flash"
      />,
    );

    expect(screen.queryByPlaceholderText("API Endpoint")).toBeNull();
    expect(screen.getByPlaceholderText("API Key")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Model")).toBeInTheDocument();
  });

  it("calls updateRestProvider on field change", () => {
    render(
      <RestProviderConfigFields
        type="openai"
        endpoint="https://api.openai.com"
        apiKey=""
        model="gpt-4o"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("API Key"), {
      target: { value: "sk-new" },
    });

    expect(getUpdateMock()).toHaveBeenCalledWith("openai", { apiKey: "sk-new" });
  });

  it("calls updateRestProvider for endpoint change", () => {
    render(
      <RestProviderConfigFields
        type="anthropic"
        endpoint="https://api.anthropic.com"
        apiKey="sk-test"
        model="model"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("API Endpoint"), {
      target: { value: "https://custom.endpoint.com" },
    });

    expect(getUpdateMock()).toHaveBeenCalledWith("anthropic", {
      endpoint: "https://custom.endpoint.com",
    });
  });

  it("calls updateRestProvider for model change", () => {
    render(
      <RestProviderConfigFields
        type="openai"
        endpoint=""
        apiKey=""
        model="gpt-4o"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Model"), {
      target: { value: "gpt-4o-mini" },
    });

    expect(getUpdateMock()).toHaveBeenCalledWith("openai", { model: "gpt-4o-mini" });
  });

  // --- Test button ---

  it("renders test button and disables it when no API key", () => {
    render(
      <RestProviderConfigFields
        type="openai"
        endpoint=""
        apiKey=""
        model="gpt-4o"
      />,
    );

    const testBtn = screen.getByTitle("Test API key");
    expect(testBtn).toBeInTheDocument();
    expect(testBtn).toBeDisabled();
  });

  it("enables test button when API key is provided", () => {
    render(
      <RestProviderConfigFields
        type="openai"
        endpoint=""
        apiKey="sk-test"
        model="gpt-4o"
      />,
    );

    const testBtn = screen.getByTitle("Test API key");
    expect(testBtn).not.toBeDisabled();
  });

  it("enables test button for ollama-api even without API key", () => {
    render(
      <RestProviderConfigFields
        type="ollama-api"
        endpoint="http://localhost:11434"
        apiKey=""
        model="llama3.2"
      />,
    );

    const testBtn = screen.getByTitle("Test API key");
    expect(testBtn).not.toBeDisabled();
  });

  it("calls invoke on test button click and shows success toast", async () => {
    mockInvoke.mockResolvedValue("Connected");

    render(
      <RestProviderConfigFields
        type="openai"
        endpoint="https://api.openai.com"
        apiKey="sk-test"
        model="gpt-4o"
      />,
    );

    fireEvent.click(screen.getByTitle("Test API key"));

    expect(mockInvoke).toHaveBeenCalledWith("test_api_key", {
      provider: "openai",
      apiKey: "sk-test",
      endpoint: "https://api.openai.com",
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Connected");
    });
  });

  it("shows error toast and X icon on test failure", async () => {
    mockInvoke.mockRejectedValue("HTTP 401: Unauthorized");

    render(
      <RestProviderConfigFields
        type="anthropic"
        endpoint="https://api.anthropic.com"
        apiKey="bad-key"
        model="model"
      />,
    );

    fireEvent.click(screen.getByTitle("Test API key"));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("HTTP 401: Unauthorized");
    });

    // X icon should be visible in the test button during failure state
    const testBtn = screen.getByTitle("Test API key");
    const xIcon = testBtn.querySelector("svg");
    expect(xIcon).toBeInTheDocument();
  });
});
