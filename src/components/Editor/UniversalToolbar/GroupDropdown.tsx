/**
 * GroupDropdown - Dropdown menu for toolbar groups
 *
 * Per spec Section 3.2 and 6:
 * - Initial focus: active+enabled item, else first enabled, else first
 * - ↑/↓: Navigate within dropdown (skip disabled, wrap)
 * - ←/→: Close dropdown, move to adjacent toolbar button
 * - Tab/Shift+Tab: Close dropdown, move to next/prev toolbar button
 * - Escape: Close dropdown (toolbar button stays focused)
 * - ARIA roles: menuitemcheckbox for toggles, menuitemradio for mutually exclusive, menuitem for actions
 *
 * @module components/Editor/UniversalToolbar/GroupDropdown
 */
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
  groupId: string;
  onSelect: (action: string) => void;
  onClose: () => void;
  /** Called when ← or → is pressed - direction to move */
  onNavigateOut?: (direction: "left" | "right") => void;
  /** Called when Tab or Shift+Tab is pressed - direction to move */
  onTabOut?: (direction: "forward" | "backward") => void;
}

/** Groups where items are mutually exclusive (radio behavior) */
const RADIO_GROUPS = new Set(["block", "list"]);

/** Toggle format actions (checkbox behavior) */
const TOGGLE_ACTIONS = new Set([
  "bold", "italic", "underline", "strikethrough", "highlight",
  "superscript", "subscript", "code",
]);

/**
 * Determine ARIA role for a menu item.
 */
function getItemRole(action: string, groupId: string): "menuitemcheckbox" | "menuitemradio" | "menuitem" {
  if (RADIO_GROUPS.has(groupId)) {
    return "menuitemradio";
  }
  if (TOGGLE_ACTIONS.has(action)) {
    return "menuitemcheckbox";
  }
  return "menuitem";
}

const GroupDropdown = forwardRef<HTMLDivElement, GroupDropdownProps>(
  ({ anchorRect, items, groupId, onSelect, onClose, onNavigateOut, onTabOut }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Track if this is the initial mount (to avoid stealing focus on re-renders)
    const isInitialMount = useRef(true);

    // Find enabled button indices (in button-space, excludes separators)
    const enabledButtonIndices = useMemo(() => {
      const indices: number[] = [];
      let buttonIndex = 0;
      items.forEach((entry) => {
        if (!isSeparator(entry.item)) {
          if (!entry.state.disabled) {
            indices.push(buttonIndex);
          }
          buttonIndex++;
        }
      });
      return indices;
    }, [items]);

    // Focus first enabled button on mount only (not on re-renders)
    // This prevents stealing focus from toolbar buttons during click events
    useEffect(() => {
      if (!isInitialMount.current) return;
      isInitialMount.current = false;

      const container = containerRef.current;
      if (!container) return;

      const buttons = container.querySelectorAll<HTMLButtonElement>(
        ".universal-toolbar-dropdown-item"
      );
      const firstEnabled = enabledButtonIndices[0] ?? 0;
      buttons[firstEnabled]?.focus();
    }, [enabledButtonIndices]);

    /**
     * Find next enabled button index in direction (wrapping).
     * Works in button-space (excludes separators).
     */
    const findNextEnabledButtonIndex = (currentButtonIndex: number, direction: 1 | -1): number => {
      if (enabledButtonIndices.length === 0) return currentButtonIndex;

      const currentEnabledPos = enabledButtonIndices.indexOf(currentButtonIndex);
      if (currentEnabledPos === -1) {
        // Current is disabled, find nearest enabled
        return enabledButtonIndices[0];
      }

      const nextPos = (currentEnabledPos + direction + enabledButtonIndices.length) % enabledButtonIndices.length;
      return enabledButtonIndices[nextPos];
    };

    const handleKeyDown = (event: ReactKeyboardEvent) => {
      const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>(
        ".universal-toolbar-dropdown-item"
      );
      if (!buttons || buttons.length === 0) return;

      // activeIndex is in button-space (excludes separators)
      const activeButtonIndex = Array.from(buttons).indexOf(document.activeElement as HTMLButtonElement);

      switch (event.key) {
        case "Escape":
          event.preventDefault();
          onClose();
          break;

        case "Tab":
          // Tab exits dropdown and moves to next/prev toolbar button
          event.preventDefault();
          if (onTabOut) {
            onTabOut(event.shiftKey ? "backward" : "forward");
          } else {
            onClose();
          }
          break;

        case "ArrowLeft":
          // ← exits dropdown and moves to previous toolbar button
          event.preventDefault();
          if (onNavigateOut) {
            onNavigateOut("left");
          } else {
            onClose();
          }
          break;

        case "ArrowRight":
          // → exits dropdown and moves to next toolbar button
          event.preventDefault();
          if (onNavigateOut) {
            onNavigateOut("right");
          } else {
            onClose();
          }
          break;

        case "ArrowDown":
          event.preventDefault();
          if (enabledButtonIndices.length > 0) {
            const nextIndex = findNextEnabledButtonIndex(activeButtonIndex, 1);
            buttons[nextIndex]?.focus();
          }
          break;

        case "ArrowUp":
          event.preventDefault();
          if (enabledButtonIndices.length > 0) {
            const prevIndex = findNextEnabledButtonIndex(activeButtonIndex, -1);
            buttons[prevIndex]?.focus();
          }
          break;

        case "Home":
          event.preventDefault();
          if (enabledButtonIndices.length > 0) {
            buttons[enabledButtonIndices[0]]?.focus();
          }
          break;

        case "End":
          event.preventDefault();
          if (enabledButtonIndices.length > 0) {
            buttons[enabledButtonIndices[enabledButtonIndices.length - 1]]?.focus();
          }
          break;

        case "Enter":
        case " ":
          // Let the button's click handler deal with it
          break;
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
        aria-label={`${groupId} options`}
      >
        {items.map(({ item, state }) => {
          if (isSeparator(item)) {
            return <div key={item.id} className="universal-toolbar-dropdown-separator" role="separator" />;
          }
          const actionItem = item as ToolbarActionItem;
          const role = getItemRole(actionItem.action, groupId);
          const showChecked = role === "menuitemcheckbox" || role === "menuitemradio";

          return (
            <button
              key={actionItem.id}
              type="button"
              role={role}
              aria-checked={showChecked ? state.active : undefined}
              aria-disabled={state.disabled || undefined}
              className={`universal-toolbar-dropdown-item${state.active ? " active" : ""}${state.disabled ? " disabled" : ""}`}
              onClick={() => {
                if (!state.disabled) {
                  onSelect(actionItem.action);
                }
              }}
              tabIndex={-1}
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
