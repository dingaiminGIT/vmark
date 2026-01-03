import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Editor } from "./Editor";
import { WindowProvider } from "@/contexts/WindowContext";

// Mock Tauri APIs
vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({ label: "main" }),
}));

// Mock useEditorStore
vi.mock("@/stores/editorStore", () => ({
  useEditorStore: vi.fn((selector) => {
    const state = {
      content: "",
      setContent: vi.fn(),
    };
    return selector(state);
  }),
}));

// Mock useDocumentStore as a zustand hook
const mockDocumentStore = {
  documents: { "tab-1": { documentId: 1, content: "", isDirty: false, filePath: null } },
  getDocument: () => ({ content: "", isDirty: false, filePath: null }),
  initDocument: vi.fn(),
};

vi.mock("@/stores/documentStore", () => ({
  useDocumentStore: vi.fn((selector) => {
    if (typeof selector === "function") {
      return selector(mockDocumentStore);
    }
    return mockDocumentStore;
  }),
}));

// Mock useTabStore as a zustand hook
const mockTabStore = {
  tabs: { main: [{ id: "tab-1", filePath: null, title: "Untitled", isPinned: false }] },
  activeTabId: { main: "tab-1" },
  getTabsByWindow: () => [{ id: "tab-1", filePath: null, title: "Untitled", isPinned: false }],
  createTab: vi.fn(() => "tab-1"),
};

vi.mock("@/stores/tabStore", () => ({
  useTabStore: vi.fn((selector) => {
    if (typeof selector === "function") {
      return selector(mockTabStore);
    }
    return mockTabStore;
  }),
}));

function renderWithProvider(ui: React.ReactElement) {
  return render(<WindowProvider>{ui}</WindowProvider>);
}

describe("Editor", () => {
  it("renders the editor container", () => {
    renderWithProvider(<Editor />);

    const container = document.querySelector(".editor-container");
    expect(container).toBeInTheDocument();
  });

  it("renders the editor content area", () => {
    renderWithProvider(<Editor />);

    const content = document.querySelector(".editor-content");
    expect(content).toBeInTheDocument();
  });
});
