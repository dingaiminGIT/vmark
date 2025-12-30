import { Component, type ReactNode } from "react";
import { Routes, Route } from "react-router-dom";
import { Editor } from "@/components/Editor";
import { Sidebar } from "@/components/Sidebar";
import { StatusBar } from "@/components/StatusBar";
import { FindBar } from "@/components/FindBar";
import { SettingsPage } from "@/pages/Settings";
import { PrintPreviewPage } from "@/pages/PrintPreview";
import { WindowProvider, useIsDocumentWindow } from "@/contexts/WindowContext";

// Error Boundary to catch and display React errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Error info:", errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ color: "#dc2626", marginBottom: 16 }}>Something went wrong</h1>
          <pre style={{
            padding: 16,
            background: "#fef2f2",
            borderRadius: 8,
            overflow: "auto",
            fontSize: 14,
          }}>
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";
import { useMenuEvents } from "@/hooks/useMenuEvents";
import { useFileOperations } from "@/hooks/useFileOperations";
import { useSearchCommands } from "@/hooks/useSearchCommands";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useTheme } from "@/hooks/useTheme";
import { useSettingsSync } from "@/hooks/useSettingsSync";
import { useRecentFilesSync } from "@/hooks/useRecentFilesSync";
import { useWindowClose } from "@/hooks/useWindowClose";
import { useAppQuit } from "@/hooks/useAppQuit";
import { useWindowTitle } from "@/hooks/useWindowTitle";

// Separate component for window lifecycle hooks to avoid conditional hook calls
function DocumentWindowHooks() {
  useWindowClose();
  useAppQuit();
  useWindowTitle();
  return null;
}

function MainLayout() {
  const focusModeEnabled = useEditorStore((state) => state.focusModeEnabled);
  const typewriterModeEnabled = useEditorStore(
    (state) => state.typewriterModeEnabled
  );
  const sidebarVisible = useUIStore((state) => state.sidebarVisible);
  const isDocumentWindow = useIsDocumentWindow();

  // Initialize hooks
  useMenuEvents();
  useFileOperations();
  useSearchCommands();
  useSettingsSync(); // Sync settings across windows
  useTheme();
  useAutoSave(); // Auto-save when dirty
  useRecentFilesSync(); // Sync recent files to native menu

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
        height: "100vh",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Window lifecycle hooks for document windows */}
      {isDocumentWindow && <DocumentWindowHooks />}

      {/* Drag region overlay - absolute positioned at top for consistent drag behavior */}
      <div
        data-tauri-drag-region
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 52,
          zIndex: 100,
        }}
      />

      {sidebarVisible && (
        <aside
          style={{
            width: 240,
            minWidth: 240,
            height: "100%",
            flexShrink: 0,
          }}
        >
          <Sidebar />
        </aside>
      )}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Spacer for title bar area */}
        <div style={{ height: 52, flexShrink: 0 }} />
        <div style={{ flex: 1, minHeight: 0, marginBottom: 40 }}>
          <Editor />
        </div>
        <FindBar />
        <StatusBar />
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <WindowProvider>
        <Routes>
          <Route path="/" element={<MainLayout />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/print-preview" element={<PrintPreviewPage />} />
        </Routes>
      </WindowProvider>
    </ErrorBoundary>
  );
}

export default App;
