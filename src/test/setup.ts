import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Tauri APIs
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
  readDir: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
  message: vi.fn(),
  ask: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readText: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: vi.fn(() => ({
    onDragDropEvent: vi.fn(() => Promise.resolve(() => {})),
  })),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    label: "main",
    isFocused: vi.fn(() => Promise.resolve(true)),
  })),
}));

vi.mock("@tauri-apps/api/webviewWindow", () => {
  const mockUnlisten = vi.fn();
  return {
    getCurrentWebviewWindow: vi.fn(() => ({
      label: "main",
      isFocused: vi.fn(() => Promise.resolve(true)),
      listen: vi.fn(() => Promise.resolve(mockUnlisten)),
      emit: vi.fn(),
      close: vi.fn(),
      onDragDropEvent: vi.fn(() => Promise.resolve(() => {})),
    })),
    WebviewWindow: {
      getByLabel: vi.fn(() => Promise.resolve(null)),
    },
  };
});

vi.mock("@tauri-apps/api/path", () => ({
  homeDir: vi.fn(() => Promise.resolve("/Users/test")),
  appDataDir: vi.fn(() => Promise.resolve("/Users/test/.config")),
  join: vi.fn((...parts: string[]) => Promise.resolve(parts.join("/"))),
  dirname: vi.fn((path: string) => Promise.resolve(path.split("/").slice(0, -1).join("/") || "/")),
  basename: vi.fn((path: string) => Promise.resolve(path.split("/").pop() || "")),
}));
