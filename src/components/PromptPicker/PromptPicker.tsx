/**
 * Prompt Picker
 *
 * Spotlight-style centered overlay for browsing and invoking AI prompts.
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
import { usePromptPickerStore } from "@/stores/promptPickerStore";
import { usePromptsStore } from "@/stores/promptsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { usePromptInvocation } from "@/hooks/usePromptInvocation";
import type { PromptDefinition, PromptScope } from "@/types/aiPrompts";
import { PromptChips } from "./PromptChips";
import "./prompt-picker.css";

const SCOPES: PromptScope[] = ["selection", "block", "document"];

export function PromptPicker() {
  const isOpen = usePromptPickerStore((s) => s.isOpen);
  const filterScope = usePromptPickerStore((s) => s.filterScope);

  const prompts = usePromptsStore((s) => s.prompts);
  const loading = usePromptsStore((s) => s.loading);

  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeScope, setActiveScope] = useState<PromptScope | null>(null);
  const [freeform, setFreeform] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const freeformRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { invokePrompt, invokeFreeform, isRunning } = usePromptInvocation();

  // Load prompts on open
  useEffect(() => {
    if (isOpen) {
      const rootPath = useWorkspaceStore.getState().rootPath;
      usePromptsStore.getState().loadPrompts(rootPath);
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

  // Filtered + grouped prompts
  const filtered = useMemo(() => {
    const lower = filter.toLowerCase();
    return prompts.filter((p) => {
      if (activeScope && p.metadata.scope !== activeScope) return false;
      if (!lower) return true;
      return (
        p.metadata.name.toLowerCase().includes(lower) ||
        p.metadata.description.toLowerCase().includes(lower) ||
        (p.metadata.category?.toLowerCase().includes(lower) ?? false)
      );
    });
  }, [filter, activeScope, prompts]);

  const recents = useMemo(() => {
    if (filter) return [];
    return usePromptsStore.getState().getRecent().filter((p) => {
      if (activeScope && p.metadata.scope !== activeScope) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, activeScope, prompts]);

  const grouped = useMemo(() => {
    const groups = new Map<string, PromptDefinition[]>();
    for (const p of filtered) {
      // Skip recents from main list if showing recents section
      if (!filter && recents.some((r) => r.metadata.name === p.metadata.name)) {
        continue;
      }
      const cat = p.metadata.category ?? "Uncategorized";
      const list = groups.get(cat) ?? [];
      list.push(p);
      groups.set(cat, list);
    }
    return groups;
  }, [filtered, filter, recents]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    const items: PromptDefinition[] = [];
    if (recents.length > 0) items.push(...recents);
    for (const [, list] of grouped) {
      items.push(...list);
    }
    return items;
  }, [recents, grouped]);

  const handleClose = useCallback(() => {
    usePromptPickerStore.getState().closePicker();
    setFilter("");
    setSelectedIndex(0);
    setFreeform("");
  }, []);

  const handleSelect = useCallback(
    (prompt: PromptDefinition) => {
      handleClose();
      invokePrompt(prompt, activeScope ?? undefined);
    },
    [handleClose, invokePrompt, activeScope]
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
    <div className="prompt-picker-backdrop">
      <div
        ref={containerRef}
        className="prompt-picker"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="prompt-picker-header">
          <input
            ref={inputRef}
            className="prompt-picker-search"
            type="text"
            placeholder="Search prompts..."
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setSelectedIndex(0);
            }}
          />
        </div>

        {/* Quick chips (only when selection scope) */}
        {activeScope === "selection" && (
          <PromptChips prompts={prompts} onSelect={handleSelect} />
        )}

        {/* Prompt list */}
        <div className="prompt-picker-list" ref={listRef}>
          {loading && (
            <div className="prompt-picker-empty">Loading prompts...</div>
          )}

          {!loading && flatList.length === 0 && !filter && (
            <div className="prompt-picker-empty">
              No prompts found. Add .md files to your prompts directory.
            </div>
          )}

          {!loading && flatList.length === 0 && filter && (
            <div className="prompt-picker-empty">
              No matching prompts for &ldquo;{filter}&rdquo;
            </div>
          )}

          {/* Recents section */}
          {recents.length > 0 && (
            <>
              <div className="prompt-picker-section-title">Recently Used</div>
              {recents.map((prompt) => {
                const idx = itemIndex++;
                return (
                  <PromptItem
                    key={`recent-${prompt.metadata.name}`}
                    prompt={prompt}
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
              <div className="prompt-picker-section-title">{category}</div>
              {list.map((prompt) => {
                const idx = itemIndex++;
                return (
                  <PromptItem
                    key={prompt.filePath}
                    prompt={prompt}
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
        <div className="prompt-picker-freeform">
          <textarea
            ref={freeformRef}
            className="prompt-picker-freeform-input"
            placeholder="Describe what you want..."
            value={freeform}
            onChange={(e) => setFreeform(e.target.value)}
            rows={1}
          />
        </div>

        {/* Footer */}
        <div className="prompt-picker-footer">
          <span className="prompt-picker-scope">
            scope: {activeScope ?? "all"}
          </span>
          {isRunning && (
            <span className="prompt-picker-running">Running...</span>
          )}
          <span className="prompt-picker-hint">
            Tab ↹ cycle scope
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ============================================================================
// Prompt Item
// ============================================================================

interface PromptItemProps {
  prompt: PromptDefinition;
  index: number;
  selected: boolean;
  onSelect: (prompt: PromptDefinition) => void;
  onHover: (index: number) => void;
}

function PromptItem({
  prompt,
  index,
  selected,
  onSelect,
  onHover,
}: PromptItemProps) {
  return (
    <div
      className={`prompt-picker-item ${selected ? "prompt-picker-item--selected" : ""}`}
      data-index={index}
      onClick={() => onSelect(prompt)}
      onMouseEnter={() => onHover(index)}
    >
      <div className="prompt-picker-item-name">
        {formatName(prompt.metadata.name)}
      </div>
      <div className="prompt-picker-item-meta">
        {prompt.metadata.description && (
          <span className="prompt-picker-item-desc">
            {prompt.metadata.description}
          </span>
        )}
        <span className="prompt-picker-item-scope">
          {prompt.metadata.scope}
        </span>
      </div>
    </div>
  );
}

function formatName(name: string): string {
  return name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
