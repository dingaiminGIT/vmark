import { useMemo } from "react";
import { useEditorStore } from "@/stores/editorStore";
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

  const wordCount = useMemo(() => countWords(content), [content]);
  const charCount = useMemo(() => countCharacters(content), [content]);
  const fileName = filePath ? filePath.split("/").pop() : "Untitled";

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-file">
          {isDirty && <span className="status-dirty-indicator" />}
          {fileName}
        </span>
      </div>
      <div className="status-bar-right">
        <span className="status-item">{wordCount} words</span>
        <span className="status-separator">|</span>
        <span className="status-item">{charCount} characters</span>
      </div>
    </div>
  );
}

export default StatusBar;
