/**
 * Heading Picker Component
 *
 * Modal dialog for selecting a document heading to create bookmark links.
 * Shows all headings with indentation by level and filter support.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useHeadingPickerStore } from "@/stores/headingPickerStore";
import type { HeadingWithId } from "@/utils/headingSlug";

const icons = {
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  heading: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 12h12M6 4v16M18 4v16"/></svg>`,
};

interface HeadingItemProps {
  heading: HeadingWithId;
  isSelected: boolean;
  onSelect: () => void;
}

function HeadingItem({ heading, isSelected, onSelect }: HeadingItemProps) {
  const indent = (heading.level - 1) * 16;

  return (
    <button
      type="button"
      className={`heading-picker-item ${isSelected ? "selected" : ""}`}
      style={{ paddingLeft: `${12 + indent}px` }}
      onClick={onSelect}
      data-heading-id={heading.id}
    >
      <span className="heading-picker-level">H{heading.level}</span>
      <span className="heading-picker-text">{heading.text || "(empty heading)"}</span>
      <span className="heading-picker-id">#{heading.id}</span>
    </button>
  );
}

export function HeadingPicker() {
  const isOpen = useHeadingPickerStore((s) => s.isOpen);
  const headings = useHeadingPickerStore((s) => s.headings);

  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredHeadings = headings.filter((h) => {
    if (!filter) return true;
    const search = filter.toLowerCase();
    return h.text.toLowerCase().includes(search) || h.id.toLowerCase().includes(search);
  });

  const handleClose = useCallback(() => {
    useHeadingPickerStore.getState().closePicker();
    setFilter("");
    setSelectedIndex(0);
  }, []);

  const handleSelect = useCallback(
    (heading: HeadingWithId) => {
      useHeadingPickerStore.getState().selectHeading(heading);
      setFilter("");
      setSelectedIndex(0);
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const maxIndex = filteredHeadings.length - 1;
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (maxIndex >= 0) {
          setSelectedIndex((prev) => Math.min(prev + 1, maxIndex));
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (maxIndex >= 0) {
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredHeadings[selectedIndex];
        if (selected) {
          handleSelect(selected);
        }
      }
    },
    [filteredHeadings, selectedIndex, handleClose, handleSelect]
  );

  // Reset and clamp selection when filter changes
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (filteredHeadings.length === 0) return 0;
      return Math.min(prev, filteredHeadings.length - 1);
    });
  }, [filter, filteredHeadings.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector(".heading-picker-item.selected");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="heading-picker-overlay" onClick={handleClose}>
      <div
        className="heading-picker"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="heading-picker-header">
          <span dangerouslySetInnerHTML={{ __html: icons.heading }} />
          <span>Select Heading</span>
          <button
            type="button"
            className="heading-picker-close"
            onClick={handleClose}
            title="Close"
            dangerouslySetInnerHTML={{ __html: icons.close }}
          />
        </div>

        <input
          ref={inputRef}
          type="text"
          className="heading-picker-filter"
          placeholder="Filter headings..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        <div className="heading-picker-list" ref={listRef}>
          {filteredHeadings.length === 0 ? (
            <div className="heading-picker-empty">
              {headings.length === 0
                ? "No headings in document"
                : "No headings match filter"}
            </div>
          ) : (
            filteredHeadings.map((heading, index) => (
              <HeadingItem
                key={`${heading.id}-${heading.pos}`}
                heading={heading}
                isSelected={index === selectedIndex}
                onSelect={() => handleSelect(heading)}
              />
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
