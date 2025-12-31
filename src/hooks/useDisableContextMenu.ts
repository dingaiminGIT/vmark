import { useEffect } from "react";

/**
 * Disables the default browser context menu (with "Reload", "Inspect", etc.)
 * Custom context menus should call e.preventDefault() before this handler runs.
 */
export function useDisableContextMenu() {
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Allow custom context menus that already called preventDefault
      if (e.defaultPrevented) return;

      // Block the default browser context menu
      e.preventDefault();
    };

    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);
}
