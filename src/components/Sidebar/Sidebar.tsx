import { useState, useMemo } from "react";
import { FolderOpen, TableOfContents, PanelRightOpen } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";
import "./Sidebar.css";

type ViewMode = "files" | "outline";

interface HeadingItem {
  level: number;
  text: string;
  id: string;
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
        id: `heading-${i}`,
      });
    }
  }

  return headings;
}

function FilesView() {
  const filePath = useEditorStore((state) => state.filePath);
  const fileName = filePath ? filePath.split("/").pop() : null;

  return (
    <div className="sidebar-view">
      {fileName ? (
        <div className="sidebar-file active">
          <div className="sidebar-file-name">{fileName?.replace(/\.md$/, "")}</div>
        </div>
      ) : (
        <div className="sidebar-empty">No file open</div>
      )}
    </div>
  );
}

function OutlineView() {
  const content = useEditorStore((state) => state.content);
  const headings = useMemo(() => extractHeadings(content), [content]);

  return (
    <div className="sidebar-view">
      {headings.length > 0 ? (
        <ul className="outline-list">
          {headings.map((heading) => (
            <li
              key={heading.id}
              className={`outline-item outline-level-${heading.level}`}
            >
              {heading.text}
            </li>
          ))}
        </ul>
      ) : (
        <div className="sidebar-empty">No headings</div>
      )}
    </div>
  );
}

export function Sidebar() {
  const [viewMode, setViewMode] = useState<ViewMode>("outline");

  const handleToggleView = () => {
    setViewMode((prev) => (prev === "files" ? "outline" : "files"));
  };

  return (
    <div className="sidebar" style={{ width: "100%", height: "100%" }}>
      {/* Drag region for traffic lights area */}
      <div data-tauri-drag-region style={{ height: 32, flexShrink: 0, cursor: "grab" }} />
      <div className="sidebar-header">
        <button
          className="sidebar-btn"
          onClick={handleToggleView}
          title={viewMode === "files" ? "Show Outline" : "Show Files"}
        >
          {viewMode === "files" ? (
            <FolderOpen size={16} />
          ) : (
            <TableOfContents size={16} />
          )}
        </button>
        <span className="sidebar-title">
          {viewMode === "files" ? "FILES" : "OUTLINE"}
        </span>
        <button
          className="sidebar-btn"
          onClick={() => useUIStore.getState().toggleSidebar()}
          title="Close Sidebar"
        >
          <PanelRightOpen size={16} />
        </button>
      </div>

      <div className="sidebar-content">
        {viewMode === "files" ? <FilesView /> : <OutlineView />}
      </div>
    </div>
  );
}

export default Sidebar;
