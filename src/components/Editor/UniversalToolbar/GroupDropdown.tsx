import { forwardRef, useEffect, useMemo, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { isSeparator, type ToolbarMenuItem, type ToolbarActionItem } from "./toolbarGroups";
import type { ToolbarItemState } from "@/plugins/toolbarActions/enableRules";

interface GroupDropdownItem {
  item: ToolbarMenuItem;
  state: ToolbarItemState;
}

interface GroupDropdownProps {
  anchorRect: DOMRect;
  items: GroupDropdownItem[];
  onSelect: (action: string) => void;
  onClose: () => void;
}

const GroupDropdown = forwardRef<HTMLDivElement, GroupDropdownProps>(
  ({ anchorRect, items, onSelect, onClose }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const enabledIndices = useMemo(
      () =>
        items
          .map((entry, index) => {
            // Separators are not selectable
            if (isSeparator(entry.item)) return -1;
            return entry.state.disabled ? -1 : index;
          })
          .filter((i) => i >= 0),
      [items]
    );

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const buttons = container.querySelectorAll<HTMLButtonElement>(
        ".universal-toolbar-dropdown-item"
      );
      const firstEnabled = enabledIndices[0] ?? 0;
      const targetButton = buttons[firstEnabled] ?? buttons[0];
      targetButton?.focus();
    }, [enabledIndices]);

    const handleKeyDown = (event: ReactKeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>(
          ".universal-toolbar-dropdown-item"
        );
        if (!buttons || buttons.length === 0) return;
        const activeIndex = Array.from(buttons).indexOf(document.activeElement as HTMLButtonElement);
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex = (activeIndex + direction + buttons.length) % buttons.length;
        buttons[nextIndex]?.focus();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>(
          ".universal-toolbar-dropdown-item"
        );
        if (!buttons || buttons.length === 0) return;
        const activeIndex = Array.from(buttons).indexOf(document.activeElement as HTMLButtonElement);
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = (activeIndex + direction + buttons.length) % buttons.length;
        buttons[nextIndex]?.focus();
      }
    };

    return (
      <div
        ref={(node) => {
          containerRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className="universal-toolbar-dropdown"
        style={{ top: anchorRect.top - 8, left: anchorRect.left }}
        onKeyDown={handleKeyDown}
        role="menu"
        aria-label="Toolbar group"
      >
        {items.map(({ item, state }) => {
          if (isSeparator(item)) {
            return <div key={item.id} className="universal-toolbar-dropdown-separator" role="separator" />;
          }
          const actionItem = item as ToolbarActionItem;
          return (
            <button
              key={actionItem.id}
              type="button"
              className={`universal-toolbar-dropdown-item${state.active ? " active" : ""}`}
              onClick={() => onSelect(actionItem.action)}
              disabled={state.disabled}
              title={state.notImplemented ? `${actionItem.label} — Not available yet` : actionItem.label}
            >
              <span
                className="universal-toolbar-dropdown-icon"
                dangerouslySetInnerHTML={{ __html: actionItem.icon }}
              />
              <span className="universal-toolbar-dropdown-label">{actionItem.label}</span>
              {actionItem.shortcut && (
                <span className="universal-toolbar-dropdown-shortcut">{actionItem.shortcut}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }
);

GroupDropdown.displayName = "GroupDropdown";

export { GroupDropdown };
