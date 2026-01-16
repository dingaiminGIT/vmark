import { useCallback, useState, useRef, type MouseEvent } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWindowLabel } from "@/contexts/WindowContext";
import { useTabStore, type Tab as TabType } from "@/stores/tabStore";
import { closeTabWithDirtyCheck } from "@/hooks/useTabOperations";
import { Tab } from "./Tab";
import { TabContextMenu, type ContextMenuPosition } from "./TabContextMenu";

export function TabBar() {
  const windowLabel = useWindowLabel();
  const tabs = useTabStore((state) => state.tabs[windowLabel] ?? []);
  const activeTabId = useTabStore((state) => state.activeTabId[windowLabel]);

  const [contextMenu, setContextMenu] = useState<{
    position: ContextMenuPosition;
    tab: TabType;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const handleActivateTab = useCallback(
    (tabId: string) => {
      useTabStore.getState().setActiveTab(windowLabel, tabId);
    },
    [windowLabel]
  );

  const handleCloseTab = useCallback(
    async (tabId: string) => {
      await closeTabWithDirtyCheck(windowLabel, tabId);
    },
    [windowLabel]
  );

  const handleContextMenu = useCallback(
    (e: MouseEvent, tab: TabType) => {
      e.preventDefault();
      setContextMenu({
        position: { x: e.clientX, y: e.clientY },
        tab,
      });
    },
    []
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleNewTab = useCallback(() => {
    const tabId = useTabStore.getState().createTab(windowLabel, null);
    useDocumentStore.getState().initDocument(tabId, "", null);
  }, [windowLabel]);

  // Don't render if no tabs (shouldn't happen normally)
  if (tabs.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center h-9",
          "bg-[var(--bg-secondary)] border-b border-[var(--border-primary)]",
          "select-none"
        )}
        data-tauri-drag-region
      >
        {/* Tab list with horizontal scroll */}
        <div
          ref={scrollRef}
          className="flex-1 flex items-center overflow-x-auto scrollbar-none"
          role="tablist"
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onActivate={() => handleActivateTab(tab.id)}
              onClose={() => handleCloseTab(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab)}
            />
          ))}
        </div>

        {/* New tab button */}
        <button
          type="button"
          className={cn(
            "flex-shrink-0 w-8 h-8 flex items-center justify-center",
            "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]",
            "hover:bg-[var(--bg-tertiary)]",
            "transition-colors duration-100"
          )}
          onClick={handleNewTab}
          aria-label="New tab"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <TabContextMenu
          tab={contextMenu.tab}
          position={contextMenu.position}
          windowLabel={windowLabel}
          onClose={handleCloseContextMenu}
        />
      )}
    </>
  );
}

export default TabBar;
