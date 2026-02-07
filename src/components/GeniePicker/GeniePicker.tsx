/**
 * Genie Picker
 *
 * Spotlight-style centered overlay for browsing and invoking AI genies.
 * Opens via Cmd+Y, supports keyboard navigation, search, and freeform input.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useGeniePickerStore } from "@/stores/geniePickerStore";
import { useGeniesStore } from "@/stores/geniesStore";
import { useGenieInvocation } from "@/hooks/useGenieInvocation";
import type { GenieDefinition, GenieScope } from "@/types/aiGenies";
import { GenieChips } from "./GenieChips";
import { GenieItem } from "./GenieItem";
import "./genie-picker.css";

const SCOPES: GenieScope[] = ["selection", "block", "document"];

export function GeniePicker() {
  const isOpen = useGeniePickerStore((s) => s.isOpen);
  const filterScope = useGeniePickerStore((s) => s.filterScope);

  const genies = useGeniesStore((s) => s.genies);
  const loading = useGeniesStore((s) => s.loading);

  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeScope, setActiveScope] = useState<GenieScope | null>(null);
  const [freeform, setFreeform] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const freeformRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { invokeGenie, invokeFreeform, isRunning } = useGenieInvocation();

  // Load genies on open
  useEffect(() => {
    if (isOpen) {
      useGeniesStore.getState().loadGenies();
      setFilter("");
      setSelectedIndex(0);
      setFreeform("");
      setActiveScope(filterScope);
    }
  }, [isOpen, filterScope]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Filtered + grouped genies
  const filtered = useMemo(() => {
    const lower = filter.toLowerCase();
    return genies.filter((g) => {
      if (activeScope && g.metadata.scope !== activeScope) return false;
      if (!lower) return true;
      return (
        g.metadata.name.toLowerCase().includes(lower) ||
        g.metadata.description.toLowerCase().includes(lower) ||
        (g.metadata.category?.toLowerCase().includes(lower) ?? false)
      );
    });
  }, [filter, activeScope, genies]);

  const recents = useMemo(() => {
    if (filter) return [];
    return useGeniesStore.getState().getRecent().filter((g) => {
      if (activeScope && g.metadata.scope !== activeScope) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, activeScope, genies]);

  const grouped = useMemo(() => {
    const groups = new Map<string, GenieDefinition[]>();
    for (const g of filtered) {
      // Skip recents from main list if showing recents section
      if (!filter && recents.some((r) => r.metadata.name === g.metadata.name)) {
        continue;
      }
      const cat = g.metadata.category ?? "Uncategorized";
      const list = groups.get(cat) ?? [];
      list.push(g);
      groups.set(cat, list);
    }
    return groups;
  }, [filtered, filter, recents]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    const items: GenieDefinition[] = [];
    if (recents.length > 0) items.push(...recents);
    for (const [, list] of grouped) {
      items.push(...list);
    }
    return items;
  }, [recents, grouped]);

  const handleClose = useCallback(() => {
    useGeniePickerStore.getState().closePicker();
    setFilter("");
    setSelectedIndex(0);
    setFreeform("");
  }, []);

  const handleSelect = useCallback(
    (genie: GenieDefinition) => {
      handleClose();
      invokeGenie(genie, activeScope ?? undefined);
    },
    [handleClose, invokeGenie, activeScope]
  );

  const handleFreeformSubmit = useCallback(() => {
    if (!freeform.trim()) return;
    const scope = activeScope ?? "selection";
    handleClose();
    invokeFreeform(freeform.trim(), scope);
  }, [freeform, activeScope, handleClose, invokeFreeform]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const maxIndex = flatList.length - 1;

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
      } else if (e.key === "Enter" && !e.shiftKey) {
        // Check if freeform textarea is focused
        if (document.activeElement === freeformRef.current) {
          e.preventDefault();
          handleFreeformSubmit();
          return;
        }
        e.preventDefault();
        const selected = flatList[selectedIndex];
        if (selected) {
          handleSelect(selected);
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        // Cycle through scopes
        const currentIdx = activeScope ? SCOPES.indexOf(activeScope) : -1;
        const nextIdx = (currentIdx + 1) % (SCOPES.length + 1);
        setActiveScope(nextIdx === SCOPES.length ? null : SCOPES[nextIdx]);
      } else if (e.key === "Home") {
        e.preventDefault();
        setSelectedIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setSelectedIndex(maxIndex >= 0 ? maxIndex : 0);
      }
    },
    [flatList, selectedIndex, handleClose, handleSelect, activeScope, handleFreeformSubmit]
  );

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, handleClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.querySelector(
      `[data-index="${selectedIndex}"]`
    );
    if (item) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  let itemIndex = 0;

  return createPortal(
    <div className="genie-picker-backdrop">
      <div
        ref={containerRef}
        className="genie-picker"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="genie-picker-header">
          <input
            ref={inputRef}
            className="genie-picker-search"
            type="text"
            placeholder="Search genies..."
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setSelectedIndex(0);
            }}
          />
        </div>

        {/* Quick chips (only when selection scope) */}
        {activeScope === "selection" && (
          <GenieChips genies={genies} onSelect={handleSelect} />
        )}

        {/* Genie list */}
        <div className="genie-picker-list" ref={listRef}>
          {loading && (
            <div className="genie-picker-empty">Loading genies...</div>
          )}

          {!loading && flatList.length === 0 && !filter && (
            <div className="genie-picker-empty">
              No genies found. Add .md files to your genies directory.
            </div>
          )}

          {!loading && flatList.length === 0 && filter && (
            <div className="genie-picker-empty">
              No matching genies for &ldquo;{filter}&rdquo;
            </div>
          )}

          {/* Recents section */}
          {recents.length > 0 && (
            <>
              <div className="genie-picker-section-title">Recently Used</div>
              {recents.map((genie) => {
                const idx = itemIndex++;
                return (
                  <GenieItem
                    key={`recent-${genie.metadata.name}`}
                    genie={genie}
                    index={idx}
                    selected={idx === selectedIndex}
                    onSelect={handleSelect}
                    onHover={setSelectedIndex}
                  />
                );
              })}
            </>
          )}

          {/* Category sections */}
          {Array.from(grouped.entries()).map(([category, list]) => (
            <div key={category}>
              <div className="genie-picker-section-title">{category}</div>
              {list.map((genie) => {
                const idx = itemIndex++;
                return (
                  <GenieItem
                    key={genie.filePath}
                    genie={genie}
                    index={idx}
                    selected={idx === selectedIndex}
                    onSelect={handleSelect}
                    onHover={setSelectedIndex}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Freeform input */}
        <div className="genie-picker-freeform">
          <textarea
            ref={freeformRef}
            className="genie-picker-freeform-input"
            placeholder="Describe what you want..."
            value={freeform}
            onChange={(e) => setFreeform(e.target.value)}
            rows={1}
          />
        </div>

        {/* Footer */}
        <div className="genie-picker-footer">
          <span className="genie-picker-scope">
            scope: {activeScope ?? "all"}
          </span>
          {isRunning && (
            <span className="genie-picker-running">Running...</span>
          )}
          <span className="genie-picker-hint">
            Tab ↹ cycle scope
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
