import { useCallback, useRef, useEffect } from "react";
import { useUIStore } from "@/stores/uiStore";

/**
 * Hook for handling terminal panel resize via drag handle.
 * Mirrors useSidebarResize but for vertical drag (row-resize).
 */
export function useTerminalResize(onResize?: () => void) {
  const isResizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  const handlersRef = useRef<{
    move: ((e: MouseEvent) => void) | null;
    up: (() => void) | null;
  }>({ move: null, up: null });

  const cleanup = useCallback(() => {
    isResizing.current = false;
    if (handlersRef.current.move) {
      document.removeEventListener("mousemove", handlersRef.current.move);
    }
    if (handlersRef.current.up) {
      document.removeEventListener("mouseup", handlersRef.current.up);
      window.removeEventListener("blur", handlersRef.current.up);
    }
    handlersRef.current = { move: null, up: null };
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      startY.current = e.clientY;
      startHeight.current = useUIStore.getState().terminalHeight;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;
        // Drag up = taller (negative delta = more height)
        const delta = startY.current - e.clientY;
        const newHeight = startHeight.current + delta;
        useUIStore.getState().setTerminalHeight(newHeight);
        onResize?.();
      };

      const handleMouseUp = () => {
        cleanup();
      };

      handlersRef.current = { move: handleMouseMove, up: handleMouseUp };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("blur", handleMouseUp);

      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [cleanup, onResize]
  );

  return handleResizeStart;
}
