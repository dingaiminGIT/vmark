import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import type { SearchAddon } from "@xterm/addon-search";
import "./TerminalSearchBar.css";

interface TerminalSearchBarProps {
  getSearchAddon: () => SearchAddon | null;
  onClose: () => void;
}

export function TerminalSearchBar({ getSearchAddon, onClose }: TerminalSearchBarProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const findNext = useCallback(() => {
    const addon = getSearchAddon();
    if (addon && query) addon.findNext(query);
  }, [getSearchAddon, query]);

  const findPrevious = useCallback(() => {
    const addon = getSearchAddon();
    if (addon && query) addon.findPrevious(query);
  }, [getSearchAddon, query]);

  const handleClose = useCallback(() => {
    const addon = getSearchAddon();
    if (addon) addon.clearDecorations();
    onClose();
  }, [getSearchAddon, onClose]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      const addon = getSearchAddon();
      if (addon) {
        if (value) {
          addon.findNext(value);
        } else {
          addon.clearDecorations();
        }
      }
    },
    [getSearchAddon],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          findPrevious();
        } else {
          findNext();
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    },
    [findNext, findPrevious, handleClose],
  );

  return (
    <div className="terminal-search-bar">
      <input
        ref={inputRef}
        className="terminal-search-input"
        type="text"
        placeholder="Search..."
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <button
        className="terminal-search-btn"
        onClick={findPrevious}
        title="Previous (Shift+Enter)"
        disabled={!query}
      >
        <ChevronUp size={14} />
      </button>
      <button
        className="terminal-search-btn"
        onClick={findNext}
        title="Next (Enter)"
        disabled={!query}
      >
        <ChevronDown size={14} />
      </button>
      <button className="terminal-search-btn" onClick={handleClose} title="Close (Escape)">
        <X size={14} />
      </button>
    </div>
  );
}
