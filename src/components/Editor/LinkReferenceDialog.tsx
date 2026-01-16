/**
 * Link Reference Dialog Component
 *
 * Modal dialog for inserting reference links.
 * User provides identifier, URL, and optional title.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLinkReferenceDialogStore } from "@/stores/linkReferenceDialogStore";

const icons = {
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  link: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
};

export function LinkReferenceDialog() {
  const isOpen = useLinkReferenceDialogStore((s) => s.isOpen);
  const selectedText = useLinkReferenceDialogStore((s) => s.selectedText);

  const [identifier, setIdentifier] = useState("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const identifierRef = useRef<HTMLInputElement>(null);

  const handleClose = useCallback(() => {
    useLinkReferenceDialogStore.getState().closeDialog();
    setIdentifier("");
    setUrl("");
    setTitle("");
  }, []);

  const handleInsert = useCallback(() => {
    if (!identifier.trim() || !url.trim()) return;
    useLinkReferenceDialogStore.getState().insert(identifier.trim(), url.trim(), title.trim());
    setIdentifier("");
    setUrl("");
    setTitle("");
  }, [identifier, url, title]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleInsert();
      }
    },
    [handleClose, handleInsert]
  );

  // Set default identifier from selected text
  useEffect(() => {
    if (isOpen && selectedText) {
      setIdentifier(selectedText.toLowerCase().replace(/\s+/g, "-"));
    }
  }, [isOpen, selectedText]);

  // Focus identifier input when opening
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        identifierRef.current?.focus();
        identifierRef.current?.select();
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="link-reference-dialog-overlay" onClick={handleClose}>
      <div
        className="link-reference-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="link-reference-dialog-header">
          <span dangerouslySetInnerHTML={{ __html: icons.link }} />
          <span>Insert Reference Link</span>
          <button
            type="button"
            className="link-reference-dialog-close"
            onClick={handleClose}
            title="Close"
            dangerouslySetInnerHTML={{ __html: icons.close }}
          />
        </div>

        <div className="link-reference-dialog-body">
          <label className="link-reference-dialog-field">
            <span>Identifier</span>
            <input
              ref={identifierRef}
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="my-reference"
            />
          </label>

          <label className="link-reference-dialog-field">
            <span>URL</span>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </label>

          <label className="link-reference-dialog-field">
            <span>Title (optional)</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Link title"
            />
          </label>

          <div className="link-reference-dialog-preview">
            <span>Preview:</span>
            <code>[{selectedText || "text"}][{identifier || "ref"}]</code>
            <code>[{identifier || "ref"}]: {url || "url"}{title ? ` "${title}"` : ""}</code>
          </div>
        </div>

        <div className="link-reference-dialog-footer">
          <button
            type="button"
            className="link-reference-dialog-cancel"
            onClick={handleClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="link-reference-dialog-insert"
            onClick={handleInsert}
            disabled={!identifier.trim() || !url.trim()}
          >
            Insert
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
