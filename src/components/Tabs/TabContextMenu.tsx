import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useTabStore, type Tab } from "@/stores/tabStore";
import { closeTabWithDirtyCheck, closeTabsWithDirtyCheck } from "@/utils/tabUtils";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface TabContextMenuProps {
  tab: Tab;
  position: ContextMenuPosition;
  windowLabel: string;
  onClose: () => void;
}

interface MenuItem {
  label: string;
  action: () => void;
  disabled?: boolean;
  separator?: boolean;
}

export function TabContextMenu({
  tab,
  position,
  windowLabel,
  onClose,
}: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const tabs = useTabStore((state) => state.tabs[windowLabel] ?? []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleClose = useCallback(async () => {
    await closeTabWithDirtyCheck(windowLabel, tab.id);
    onClose();
  }, [windowLabel, tab.id, onClose]);

  const handleCloseOthers = useCallback(async () => {
    const tabsToClose = tabs.filter((t) => t.id !== tab.id && !t.isPinned);
    const tabIds = tabsToClose.map((t) => t.id);
    await closeTabsWithDirtyCheck(windowLabel, tabIds);
    onClose();
  }, [tabs, tab.id, windowLabel, onClose]);

  const handleCloseToRight = useCallback(async () => {
    const tabIndex = tabs.findIndex((t) => t.id === tab.id);
    const tabsToClose = tabs.filter((t, i) => i > tabIndex && !t.isPinned);
    const tabIds = tabsToClose.map((t) => t.id);
    await closeTabsWithDirtyCheck(windowLabel, tabIds);
    onClose();
  }, [tabs, tab.id, windowLabel, onClose]);

  const handleCloseAll = useCallback(async () => {
    const tabsToClose = tabs.filter((t) => !t.isPinned);
    const tabIds = tabsToClose.map((t) => t.id);
    await closeTabsWithDirtyCheck(windowLabel, tabIds);
    onClose();
  }, [tabs, windowLabel, onClose]);

  const handlePin = useCallback(() => {
    useTabStore.getState().togglePin(windowLabel, tab.id);
    onClose();
  }, [windowLabel, tab.id, onClose]);

  const tabIndex = tabs.findIndex((t) => t.id === tab.id);
  const hasTabsToRight = tabs.slice(tabIndex + 1).some((t) => !t.isPinned);
  const hasOtherTabs = tabs.filter((t) => t.id !== tab.id && !t.isPinned).length > 0;

  const menuItems: MenuItem[] = [
    {
      label: tab.isPinned ? "Unpin" : "Pin",
      action: handlePin,
    },
    { label: "", action: () => {}, separator: true },
    {
      label: "Close",
      action: handleClose,
      disabled: tab.isPinned,
    },
    {
      label: "Close Others",
      action: handleCloseOthers,
      disabled: !hasOtherTabs,
    },
    {
      label: "Close to the Right",
      action: handleCloseToRight,
      disabled: !hasTabsToRight,
    },
    {
      label: "Close All",
      action: handleCloseAll,
      disabled: tabs.every((t) => t.isPinned),
    },
  ];

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-50 min-w-[160px] py-1",
        "bg-[var(--bg-primary)] border border-[var(--border-primary)]",
        "rounded-md shadow-lg"
      )}
      style={{ left: position.x, top: position.y }}
    >
      {menuItems.map((item, index) =>
        item.separator ? (
          <div
            key={`separator-${index}`}
            className="h-px my-1 bg-[var(--border-primary)]"
          />
        ) : (
          <button
            key={item.label}
            type="button"
            className={cn(
              "w-full px-3 py-1.5 text-left text-sm",
              "text-[var(--text-primary)]",
              item.disabled
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-[var(--bg-tertiary)]"
            )}
            onClick={item.action}
            disabled={item.disabled}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

export default TabContextMenu;
