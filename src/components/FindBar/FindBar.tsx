import { useCallback, useEffect, useRef } from "react";
import { useSearchStore } from "@/stores/searchStore";
import "./FindBar.css";

export function FindBar() {
  const isOpen = useSearchStore((state) => state.isOpen);
  const showReplace = useSearchStore((state) => state.showReplace);
  const query = useSearchStore((state) => state.query);
  const replaceText = useSearchStore((state) => state.replaceText);
  const caseSensitive = useSearchStore((state) => state.caseSensitive);
  const wholeWord = useSearchStore((state) => state.wholeWord);
  const matchCount = useSearchStore((state) => state.matchCount);
  const currentIndex = useSearchStore((state) => state.currentIndex);

  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Focus find input when opening
  useEffect(() => {
    if (isOpen && findInputRef.current) {
      findInputRef.current.focus();
      findInputRef.current.select();
    }
  }, [isOpen]);

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    useSearchStore.getState().setQuery(e.target.value);
  }, []);

  const handleReplaceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    useSearchStore.getState().setReplaceText(e.target.value);
  }, []);

  const handleFindKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        useSearchStore.getState().findPrevious();
      } else {
        useSearchStore.getState().findNext();
      }
    } else if (e.key === "Escape") {
      useSearchStore.getState().close();
    } else if (e.key === "Tab" && showReplace && !e.shiftKey) {
      e.preventDefault();
      replaceInputRef.current?.focus();
    }
  }, [showReplace]);

  const handleReplaceKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      useSearchStore.getState().replaceCurrent();
    } else if (e.key === "Escape") {
      useSearchStore.getState().close();
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      findInputRef.current?.focus();
    }
  }, []);

  const handleClose = useCallback(() => {
    useSearchStore.getState().close();
  }, []);

  const handleFindNext = useCallback(() => {
    useSearchStore.getState().findNext();
  }, []);

  const handleFindPrevious = useCallback(() => {
    useSearchStore.getState().findPrevious();
  }, []);

  const handleToggleCaseSensitive = useCallback(() => {
    useSearchStore.getState().toggleCaseSensitive();
  }, []);

  const handleToggleWholeWord = useCallback(() => {
    useSearchStore.getState().toggleWholeWord();
  }, []);

  const handleReplaceCurrent = useCallback(() => {
    useSearchStore.getState().replaceCurrent();
  }, []);

  const handleReplaceAll = useCallback(() => {
    useSearchStore.getState().replaceAll();
  }, []);

  if (!isOpen) return null;

  const matchDisplay =
    matchCount === 0
      ? query
        ? "No results"
        : ""
      : `${currentIndex + 1} of ${matchCount}`;

  return (
    <div className="find-bar">
      {/* Find Row */}
      <div className="find-bar-row">
        <div className="find-bar-input-group">
          <svg className="find-bar-icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zm-.82 4.74a6 6 0 1 1 1.06-1.06l3.04 3.04-1.06 1.06-3.04-3.04z" />
          </svg>
          <input
            ref={findInputRef}
            type="text"
            className="find-bar-input"
            placeholder="Find..."
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleFindKeyDown}
          />
        </div>

        <div className="find-bar-toggles">
          <button
            className={`find-bar-toggle ${caseSensitive ? "active" : ""}`}
            onClick={handleToggleCaseSensitive}
            title="Match Case (Aa)"
          >
            Aa
          </button>
          <button
            className={`find-bar-toggle ${wholeWord ? "active" : ""}`}
            onClick={handleToggleWholeWord}
            title="Whole Word"
          >
            Ab|
          </button>
        </div>

        <div className="find-bar-nav">
          <button
            className="find-bar-nav-btn"
            onClick={handleFindPrevious}
            disabled={matchCount === 0}
            title="Previous (Shift+Enter)"
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 4l5 5h-10z" />
            </svg>
          </button>
          <span className="find-bar-count">{matchDisplay}</span>
          <button
            className="find-bar-nav-btn"
            onClick={handleFindNext}
            disabled={matchCount === 0}
            title="Next (Enter)"
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 12l5-5h-10z" />
            </svg>
          </button>
        </div>

        <button className="find-bar-close" onClick={handleClose} title="Close (Esc)">
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
          </svg>
        </button>
      </div>

      {/* Replace Row */}
      {showReplace && (
        <div className="find-bar-row find-bar-replace-row">
          <div className="find-bar-input-group">
            <svg className="find-bar-icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 4l4 4-4 4V4zm6 0h8v1.5H8V4zm0 3h8v1.5H8V7zm0 3h8v1.5H8v-1.5z" />
            </svg>
            <input
              ref={replaceInputRef}
              type="text"
              className="find-bar-input"
              placeholder="Replace..."
              value={replaceText}
              onChange={handleReplaceChange}
              onKeyDown={handleReplaceKeyDown}
            />
          </div>

          <div className="find-bar-replace-actions">
            <button
              className="find-bar-btn"
              onClick={handleReplaceCurrent}
              disabled={matchCount === 0}
              title="Replace"
            >
              Replace
            </button>
            <button
              className="find-bar-btn"
              onClick={handleReplaceAll}
              disabled={matchCount === 0}
              title="Replace All"
            >
              All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FindBar;
