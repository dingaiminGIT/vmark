/**
 * Sidebar Component
 *
 * Navigation sidebar with Files, Outline, and History views.
 */

import { ListTree, TableOfContents, History } from "lucide-react";
import { useUIStore, type SidebarViewMode } from "@/stores/uiStore";
import { useDocumentFilePath } from "@/hooks/useDocumentState";
import { FileExplorer } from "./FileExplorer";
import { OutlineView } from "./OutlineView";
import { HistoryView } from "./HistoryView";
import "./Sidebar.css";

// Constants
const TRAFFIC_LIGHTS_SPACER_PX = 38;

// View mode configuration - single source of truth
const VIEW_CONFIG: Record<SidebarViewMode, {
  icon: typeof ListTree;
  title: string;
  next: SidebarViewMode;
}> = {
  files: { icon: ListTree, title: "FILES", next: "outline" },
  outline: { icon: TableOfContents, title: "OUTLINE", next: "history" },
  history: { icon: History, title: "HISTORY", next: "files" },
};

function FilesView() {
  const filePath = useDocumentFilePath();
  return <FileExplorer currentFilePath={filePath} />;
}

export function Sidebar() {
  const viewMode = useUIStore((state) => state.sidebarViewMode);
  const config = VIEW_CONFIG[viewMode];
  const Icon = config.icon;
  const nextTitle = VIEW_CONFIG[config.next].title;

  const handleToggleView = () => {
    const { sidebarViewMode, setSidebarViewMode } = useUIStore.getState();
    setSidebarViewMode(VIEW_CONFIG[sidebarViewMode].next);
  };

  return (
    <div className="sidebar" style={{ width: "100%", height: "100%" }}>
      {/* Spacer for traffic lights area */}
      <div style={{ height: TRAFFIC_LIGHTS_SPACER_PX, flexShrink: 0 }} />
      <div className="sidebar-header">
        <button
          className="sidebar-btn"
          onClick={handleToggleView}
          title={`Show ${nextTitle.charAt(0) + nextTitle.slice(1).toLowerCase()}`}
        >
          <Icon size={16} />
        </button>
        <span className="sidebar-title">{config.title}</span>
      </div>

      <div className="sidebar-content">
        {viewMode === "files" && <FilesView />}
        {viewMode === "outline" && <OutlineView />}
        {viewMode === "history" && <HistoryView />}
      </div>
    </div>
  );
}

export default Sidebar;
