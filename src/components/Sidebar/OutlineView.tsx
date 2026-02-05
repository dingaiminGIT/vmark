/**
 * Outline View Component
 *
 * Displays document heading structure as a tree.
 */

import { useState, useMemo, useRef } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { emit } from "@tauri-apps/api/event";
import { useUIStore } from "@/stores/uiStore";
import { useDocumentContent } from "@/hooks/useDocumentState";
import { perfStart, perfEnd } from "@/utils/perfLog";

interface HeadingItem {
  level: number;
  text: string;
  line: number; // 0-based line number in content
}

interface HeadingNode extends HeadingItem {
  children: HeadingNode[];
  index: number; // Original index in flat list
}

function extractHeadings(content: string): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i,
      });
    }
  }

  return headings;
}

function buildHeadingTree(headings: HeadingItem[]): HeadingNode[] {
  const root: HeadingNode[] = [];
  const stack: HeadingNode[] = [];

  headings.forEach((heading, index) => {
    const node: HeadingNode = { ...heading, children: [], index };

    // Pop stack until we find a parent with smaller level
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  });

  return root;
}

/**
 * Extract only heading lines from content for comparison.
 * Used to avoid re-extracting headings when non-heading content changes.
 */
function getHeadingLinesKey(content: string): string {
  const lines = content.split("\n");
  const headingLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) {
      // Include line number to detect moved headings
      headingLines.push(`${i}:${lines[i]}`);
    }
  }
  return headingLines.join("\n");
}

function OutlineItem({
  node,
  activeIndex,
  collapsedSet,
  onToggle,
  onClick,
}: {
  node: HeadingNode;
  activeIndex: number;
  collapsedSet: Set<number>;
  onToggle: (index: number) => void;
  onClick: (headingIndex: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsedSet.has(node.index);
  const isActive = node.index === activeIndex;

  return (
    <li className="outline-tree-item">
      <div
        role="treeitem"
        tabIndex={0}
        aria-selected={isActive}
        aria-expanded={hasChildren ? !isCollapsed : undefined}
        className={`outline-item outline-level-${node.level} ${isActive ? "active" : ""}`}
        onClick={() => onClick(node.index)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick(node.index);
          }
        }}
      >
        {hasChildren ? (
          <button
            className="outline-toggle"
            aria-label={isCollapsed ? "Expand section" : "Collapse section"}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.index);
            }}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
        ) : (
          <span className="outline-toggle-spacer" />
        )}
        <span className="outline-text">{node.text}</span>
      </div>
      {hasChildren && !isCollapsed && (
        <ul className="outline-children" role="group">
          {node.children.map((child) => (
            <OutlineItem
              key={child.index}
              node={child}
              activeIndex={activeIndex}
              collapsedSet={collapsedSet}
              onToggle={onToggle}
              onClick={onClick}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// Size thresholds for performance
const MAX_CONTENT_FOR_OUTLINE = 100000; // 100KB threshold
const MAX_OUTLINE_ITEMS = 100; // Limit items (400+ causes severe slowdown)

export function OutlineView() {
  const content = useDocumentContent();
  const activeHeadingIndex = useUIStore((state) => state.activeHeadingLine);

  // Check if document is too large (used after hooks)
  const isTooLarge = content.length > MAX_CONTENT_FOR_OUTLINE;

  // Create a stable key based only on heading lines.
  // This prevents re-extraction when typing in non-heading content.
  const headingLinesKey = useMemo(
    () => (isTooLarge ? "" : getHeadingLinesKey(content)),
    [content, isTooLarge]
  );

  // Cache previous headings to maintain referential stability
  const prevHeadingsRef = useRef<HeadingItem[]>([]);
  const prevKeyRef = useRef<string>("");

  // Only re-extract headings when heading lines actually change
  const headings = useMemo(() => {
    if (isTooLarge) return [];
    if (headingLinesKey === prevKeyRef.current) {
      return prevHeadingsRef.current;
    }
    perfStart("OutlineView:extractHeadings");
    const newHeadings = extractHeadings(content);
    perfEnd("OutlineView:extractHeadings", { count: newHeadings.length });
    prevHeadingsRef.current = newHeadings;
    prevKeyRef.current = headingLinesKey;
    return newHeadings;
  }, [headingLinesKey, content, isTooLarge]);

  const tree = useMemo(() => {
    if (isTooLarge) return [];
    perfStart("OutlineView:buildHeadingTree");
    const result = buildHeadingTree(headings);
    perfEnd("OutlineView:buildHeadingTree", { rootNodes: result.length });
    return result;
  }, [headings, isTooLarge]);

  const activeIndex = activeHeadingIndex ?? -1;

  // Track collapsed state by heading text (preserves state across edits)
  const [collapsedTexts, setCollapsedTexts] = useState<Set<string>>(new Set());

  // Convert text-based collapsed state to index-based for rendering
  const collapsedSet = useMemo(() => {
    const set = new Set<number>();
    headings.forEach((h, i) => {
      if (collapsedTexts.has(h.text)) set.add(i);
    });
    return set;
  }, [headings, collapsedTexts]);

  const handleToggle = (index: number) => {
    const heading = headings[index];
    if (!heading) return;

    setCollapsedTexts((prev) => {
      const next = new Set(prev);
      if (next.has(heading.text)) {
        next.delete(heading.text);
      } else {
        next.add(heading.text);
      }
      return next;
    });
  };

  const handleClick = (headingIndex: number) => {
    // Emit event to scroll editor to this heading
    emit("outline:scroll-to-heading", { headingIndex });
    // Update active heading immediately for responsive UI
    useUIStore.getState().setActiveHeadingLine(headingIndex);
  };

  // Skip outline for very large documents to prevent performance issues
  if (isTooLarge) {
    return (
      <div className="sidebar-view outline-view">
        <div className="sidebar-empty">Document too large for outline</div>
      </div>
    );
  }

  const limitedTree = tree.length > MAX_OUTLINE_ITEMS ? tree.slice(0, MAX_OUTLINE_ITEMS) : tree;
  const isTruncated = tree.length > MAX_OUTLINE_ITEMS;

  return (
    <div className="sidebar-view outline-view">
      {headings.length > 0 ? (
        <>
          <ul className="outline-tree" role="tree" aria-label="Document outline">
            {limitedTree.map((node) => (
              <OutlineItem
                key={node.index}
                node={node}
                activeIndex={activeIndex}
                collapsedSet={collapsedSet}
                onToggle={handleToggle}
                onClick={handleClick}
              />
            ))}
          </ul>
          {isTruncated && (
            <div className="outline-truncated">
              + {tree.length - MAX_OUTLINE_ITEMS} more headings
            </div>
          )}
        </>
      ) : (
        <div className="sidebar-empty">No headings</div>
      )}
    </div>
  );
}
