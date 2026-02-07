import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

function getUpdateMock() {
  return useAiProviderStore.getState().updateRestProvider as ReturnType<typeof vi.fn>;
}

describe("RestProviderConfigFields", () => {
  beforeEach(() => {
    getUpdateMock().mockClear();
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
});
