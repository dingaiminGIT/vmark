import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TerminalSearchBar } from "./TerminalSearchBar";
import type { SearchAddon } from "@xterm/addon-search";

function makeMockAddon(): SearchAddon {
  return {
    findNext: vi.fn(),
    findPrevious: vi.fn(),
    clearDecorations: vi.fn(),
    dispose: vi.fn(),
  } as unknown as SearchAddon;
}

describe("TerminalSearchBar", () => {
  let addon: SearchAddon;
  let getSearchAddon: () => SearchAddon | null;
  let onClose: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    addon = makeMockAddon();
    getSearchAddon = () => addon;
    onClose = vi.fn<() => void>();
  });

  it("renders with search input", () => {
    render(<TerminalSearchBar getSearchAddon={getSearchAddon} onClose={onClose} />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("searches on input change", () => {
    render(<TerminalSearchBar getSearchAddon={getSearchAddon} onClose={onClose} />);
    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "hello" } });
    expect(addon.findNext).toHaveBeenCalledWith("hello");
  });

  it("finds next on Enter, previous on Shift+Enter", () => {
    render(<TerminalSearchBar getSearchAddon={getSearchAddon} onClose={onClose} />);
    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "test" } });

    fireEvent.keyDown(input, { key: "Enter" });
    expect(addon.findNext).toHaveBeenCalledTimes(2); // once from change, once from Enter

    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(addon.findPrevious).toHaveBeenCalledWith("test");
  });

  it("closes on Escape", () => {
    render(<TerminalSearchBar getSearchAddon={getSearchAddon} onClose={onClose} />);
    const input = screen.getByPlaceholderText("Search...");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(addon.clearDecorations).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
