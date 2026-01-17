import { useCallback, useRef, useEffect } from "react";
import { useTerminalStore, TERMINAL_MIN_HEIGHT, TERMINAL_MAX_HEIGHT } from "@/stores/terminalStore";

/**
 * Hook for handling terminal panel resize via drag handle.
 *
 * Features:
 * - Clamps height to MIN/MAX bounds
 * - Cleans up listeners on blur/unmount to prevent leaks
 * - Prevents text selection during drag
 * - Inverts drag direction (dragging up = taller)
 *
 * @returns handleResizeStart - onMouseDown handler for the resize handle
 */
export function useTerminalResize() {
  const isResizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Store references for cleanup
  const handlersRef = useRef<{
    move: ((e: MouseEvent) => void) | null;
    up: (() => void) | null;
  }>({ move: null, up: null });

  /** Clamp height to valid range */
  const clampHeight = useCallback((height: number): number => {
    return Math.max(TERMINAL_MIN_HEIGHT, Math.min(TERMINAL_MAX_HEIGHT, height));
  }, []);

  /** Clean up listeners and styles */
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

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      startY.current = e.clientY;
      startHeight.current = useTerminalStore.getState().height;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;
        // Inverted: dragging up (negative delta) should increase height
        const delta = startY.current - e.clientY;
        const newHeight = clampHeight(startHeight.current + delta);
        useTerminalStore.getState().setHeight(newHeight);
      };

      const handleMouseUp = () => {
        cleanup();
      };

      // Store references for cleanup
      handlersRef.current = { move: handleMouseMove, up: handleMouseUp };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      // Also cleanup on window blur (user switches away mid-drag)
      window.addEventListener("blur", handleMouseUp);

      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
    },
    [clampHeight, cleanup]
  );

  return handleResizeStart;
}
