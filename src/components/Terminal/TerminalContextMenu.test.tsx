import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TerminalContextMenu } from "./TerminalContextMenu";
import type { Terminal } from "@xterm/xterm";
import type { IPty } from "tauri-pty";

vi.mock("tauri-pty", () => ({ spawn: vi.fn() }));
vi.mock("@/utils/imeGuard", () => ({
  isImeKeyEvent: vi.fn(() => false),
}));

function makeTerm(overrides: Partial<Terminal> = {}): Terminal {
  return {
    hasSelection: vi.fn(() => false),
    getSelection: vi.fn(() => ""),
    clearSelection: vi.fn(),
    selectAll: vi.fn(),
    clear: vi.fn(),
    focus: vi.fn(),
    ...overrides,
  } as unknown as Terminal;
}

describe("TerminalContextMenu", () => {
  let onClose: () => void;
  let ptyRef: React.RefObject<IPty | null>;

  beforeEach(() => {
    vi.clearAllMocks();
    onClose = vi.fn<() => void>();
    ptyRef = { current: { write: vi.fn() } as unknown as IPty };
  });

  it("renders all menu items", () => {
    const term = makeTerm();
    render(
      <TerminalContextMenu
        position={{ x: 100, y: 100 }}
        term={term}
        ptyRef={ptyRef}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText("Paste")).toBeInTheDocument();
    expect(screen.getByText("Select All")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("disables Copy when no selection", () => {
    const term = makeTerm({ hasSelection: vi.fn(() => false) });
    const { container } = render(
      <TerminalContextMenu
        position={{ x: 100, y: 100 }}
        term={term}
        ptyRef={ptyRef}
        onClose={onClose}
      />,
    );

    const copyItem = container.querySelector(".context-menu-item");
    expect(copyItem).toHaveStyle({ opacity: "0.4" });
  });

  it("enables Copy when selection exists", () => {
    const term = makeTerm({ hasSelection: vi.fn(() => true) });
    const { container } = render(
      <TerminalContextMenu
        position={{ x: 100, y: 100 }}
        term={term}
        ptyRef={ptyRef}
        onClose={onClose}
      />,
    );

    const copyItem = container.querySelector(".context-menu-item");
    expect(copyItem).toHaveStyle({ opacity: "1" });
  });

  it("closes on Escape", () => {
    const term = makeTerm();
    render(
      <TerminalContextMenu
        position={{ x: 100, y: 100 }}
        term={term}
        ptyRef={ptyRef}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on click outside", () => {
    const term = makeTerm();
    render(
      <TerminalContextMenu
        position={{ x: 100, y: 100 }}
        term={term}
        ptyRef={ptyRef}
        onClose={onClose}
      />,
    );

    fireEvent.mouseDown(document);
    expect(onClose).toHaveBeenCalled();
  });
});
