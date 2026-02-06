import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TerminalTabBar } from "./TerminalTabBar";
import {
  useTerminalSessionStore,
  resetTerminalSessionStore,
} from "@/stores/terminalSessionStore";

describe("TerminalTabBar", () => {
  let onClear: () => void;
  let onRestart: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    resetTerminalSessionStore();
    onClear = vi.fn<() => void>();
    onRestart = vi.fn<() => void>();
  });

  function renderWithSession() {
    useTerminalSessionStore.getState().createSession();
    return render(<TerminalTabBar onClear={onClear} onRestart={onRestart} />);
  }

  it("renders session tab", () => {
    renderWithSession();
    expect(screen.getByText("Terminal 1")).toBeInTheDocument();
  });

  it("creates a new session on + click", () => {
    renderWithSession();
    const addBtn = screen.getByTitle("New Terminal");
    fireEvent.click(addBtn);
    expect(useTerminalSessionStore.getState().sessions).toHaveLength(2);
  });

  it("switches active session on tab click", () => {
    useTerminalSessionStore.getState().createSession();
    useTerminalSessionStore.getState().createSession();

    render(<TerminalTabBar onClear={onClear} onRestart={onRestart} />);

    const tab1 = screen.getByText("Terminal 1");
    fireEvent.click(tab1);
    expect(useTerminalSessionStore.getState().activeSessionId).toBe(
      useTerminalSessionStore.getState().sessions[0].id,
    );
  });

  it("disables + button at 5 sessions", () => {
    for (let i = 0; i < 5; i++) {
      useTerminalSessionStore.getState().createSession();
    }
    render(<TerminalTabBar onClear={onClear} onRestart={onRestart} />);

    const addBtn = screen.getByTitle("Maximum 5 sessions");
    expect(addBtn).toBeDisabled();
  });

  it("calls onClear and onRestart", () => {
    renderWithSession();
    fireEvent.click(screen.getByTitle("Clear"));
    expect(onClear).toHaveBeenCalled();
    fireEvent.click(screen.getByTitle("Restart"));
    expect(onRestart).toHaveBeenCalled();
  });
});
