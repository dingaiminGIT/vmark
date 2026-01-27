/**
 * Outline View Component
 *
 * Displays document heading structure as a tree.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { emit } from "@tauri-apps/api/event";
import { useUIStore } from "@/stores/uiStore";
import { useDocumentContent } from "@/hooks/useDocumentState";

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
        className={`outline-item outline-level-${node.level} ${isActive ? "active" : ""}`}
        onClick={() => onClick(node.index)}
      >
        {hasChildren ? (
          <button
            className="outline-toggle"
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
        <ul className="outline-children">
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

export function OutlineView() {
  const content = useDocumentContent();
  const activeHeadingIndex = useUIStore((state) => state.activeHeadingLine);

  // Skip outline for very large documents to prevent performance issues
  const MAX_CONTENT_FOR_OUTLINE = 100000; // 100KB threshold
  if (content.length > MAX_CONTENT_FOR_OUTLINE) {
    return (
      <div className="sidebar-view outline-view">
        <div className="sidebar-empty">Document too large for outline</div>
      </div>
    );
  }


  // Create a stable key based only on heading lines.
  // This prevents re-extraction when typing in non-heading content.
  const headingLinesKey = useMemo(() => getHeadingLinesKey(content), [content]);

  // Cache previous headings to maintain referential stability
  const prevHeadingsRef = useRef<HeadingItem[]>([]);
  const prevKeyRef = useRef<string>("");

  // Only re-extract headings when heading lines actually change
  const headings = useMemo(() => {
    if (headingLinesKey === prevKeyRef.current) {
      return prevHeadingsRef.current;
    }
    const newHeadings = extractHeadings(content);
    prevHeadingsRef.current = newHeadings;
    prevKeyRef.current = headingLinesKey;
    return newHeadings;
  }, [headingLinesKey, content]);

  const tree = useMemo(() => buildHeadingTree(headings), [headings]);
  const activeIndex = activeHeadingIndex ?? -1;

  // Track collapsed state locally
  const [collapsedSet, setCollapsedSet] = useState<Set<number>>(new Set());

  // Reset collapsed state when headings change (indices become invalid)
  useEffect(() => {
    setCollapsedSet(new Set());
  }, [headings]);

  const handleToggle = (index: number) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
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

  // Limit outline items for performance (400+ items causes severe slowdown)
  const MAX_OUTLINE_ITEMS = 100;
  const limitedTree = tree.length > MAX_OUTLINE_ITEMS ? tree.slice(0, MAX_OUTLINE_ITEMS) : tree;
  const isTruncated = tree.length > MAX_OUTLINE_ITEMS;

  return (
    <div className="sidebar-view outline-view">
      {headings.length > 0 ? (
        <>
          <ul className="outline-tree">
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
