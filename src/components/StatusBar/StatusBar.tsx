import { useMemo } from "react";
import { Code2, Type, PanelLeft } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";
import "./StatusBar.css";

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

function countCharacters(text: string): number {
  return text.length;
}

export function StatusBar() {
  const content = useEditorStore((state) => state.content);
  const filePath = useEditorStore((state) => state.filePath);
  const isDirty = useEditorStore((state) => state.isDirty);
  const sourceMode = useEditorStore((state) => state.sourceMode);
  const sidebarVisible = useUIStore((state) => state.sidebarVisible);

  const wordCount = useMemo(() => countWords(content), [content]);
  const charCount = useMemo(() => countCharacters(content), [content]);
  const fileName = filePath ? filePath.split("/").pop() : "Untitled";

  return (
    <div className="status-bar-container">
      <div className="status-bar">
        <div className="status-bar-left">
          <button
            className={`status-toggle ${sidebarVisible ? "active" : ""}`}
            title="Toggle Sidebar"
            onClick={() => useUIStore.getState().toggleSidebar()}
          >
            <PanelLeft size={14} />
          </button>
          <span className="status-file">
            {isDirty && <span className="status-dirty-indicator" />}
            {fileName}
          </span>
        </div>
        <div className="status-bar-right">
          <span className="status-item">{wordCount} words</span>
          <span className="status-item">{charCount} characters</span>
          <button
            className="status-mode"
            title={sourceMode ? "Source Mode (F7)" : "Rich Text Mode (F7)"}
            onClick={() => useEditorStore.getState().toggleSourceMode()}
          >
            {sourceMode ? <Code2 size={14} /> : <Type size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default StatusBar;
