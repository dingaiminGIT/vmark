import { Editor } from "@/components/Editor";
import { StatusBar } from "@/components/StatusBar";
import { useEditorStore } from "@/stores/editorStore";
import { useMenuEvents } from "@/hooks/useMenuEvents";
import { useFileOperations } from "@/hooks/useFileOperations";

function App() {
  const focusModeEnabled = useEditorStore((state) => state.focusModeEnabled);
  const typewriterModeEnabled = useEditorStore(
    (state) => state.typewriterModeEnabled
  );

  // Initialize menu event listeners
  useMenuEvents();
  useFileOperations();

  const classNames = [
    "app-layout",
    focusModeEnabled && "focus-mode",
    typewriterModeEnabled && "typewriter-mode",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classNames}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, overflow: "hidden" }}>
        <Editor />
      </div>
      <StatusBar />
    </div>
  );
}

export default App;
