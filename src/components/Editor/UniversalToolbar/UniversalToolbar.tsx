/**
 * UniversalToolbar - Bottom formatting toolbar
 *
 * A universal, single-line toolbar anchored at the bottom of the window.
 * Triggered by Ctrl+E, provides consistent formatting actions across
 * both WYSIWYG and Source modes.
 *
 * @module components/Editor/UniversalToolbar
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";
import { useSourceCursorContextStore } from "@/stores/sourceCursorContextStore";
import { useTiptapEditorStore } from "@/stores/tiptapEditorStore";
import { getToolbarButtonState, getToolbarItemState } from "@/plugins/toolbarActions/enableRules";
import { performSourceToolbarAction, setSourceHeadingLevel } from "@/plugins/toolbarActions/sourceAdapter";
import { performWysiwygToolbarAction, setWysiwygHeadingLevel } from "@/plugins/toolbarActions/wysiwygAdapter";
import type { ToolbarContext } from "@/plugins/toolbarActions/types";
import { TOOLBAR_GROUPS, getGroupButtons } from "./toolbarGroups";
import { ToolbarButton } from "./ToolbarButton";
import { useToolbarKeyboard } from "./useToolbarKeyboard";
import { getInitialFocusIndex } from "./toolbarFocus";
import { GroupDropdown } from "./GroupDropdown";
import "./universal-toolbar.css";

/**
 * Universal bottom toolbar for formatting actions.
 *
 * Renders a fixed-position toolbar at the bottom of the editor window.
 * Visibility is controlled by the `universalToolbarVisible` state in uiStore.
 *
 * Uses FindBar geometry tokens for consistent bottom-bar alignment:
 * - Height: 40px
 * - Padding: 6px 12px
 * - Row height: 28px
 *
 * @example
 * // In App.tsx or EditorContainer
 * <UniversalToolbar />
 */
export function UniversalToolbar() {
  const visible = useUIStore((state) => state.universalToolbarVisible);
  const lastFocusedIndex = useUIStore((state) => state.lastFocusedToolbarIndex);
  const sourceMode = useEditorStore((state) => state.sourceMode);
  const wysiwygContext = useTiptapEditorStore((state) => state.context);
  const wysiwygView = useTiptapEditorStore((state) => state.editorView);
  const wysiwygEditor = useTiptapEditorStore((state) => state.editor);
  const sourceContext = useSourceCursorContextStore((state) => state.context);
  const sourceView = useSourceCursorContextStore((state) => state.editorView);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wasVisibleRef = useRef(false);

  // One toolbar button per group
  const buttons = useMemo(() => getGroupButtons(), []);

  const toolbarContext = useMemo<ToolbarContext>(() => {
    if (sourceMode) {
      return {
        surface: "source",
        view: sourceView,
        context: sourceContext,
      };
    }
    return {
      surface: "wysiwyg",
      view: wysiwygView,
      editor: wysiwygEditor,
      context: wysiwygContext,
    };
  }, [sourceMode, sourceView, sourceContext, wysiwygView, wysiwygEditor, wysiwygContext]);

  const buttonStates = useMemo(
    () => buttons.map((button) => getToolbarButtonState(button, toolbarContext)),
    [buttons, toolbarContext]
  );

  const isButtonFocusable = useCallback(
    (index: number) => !buttonStates[index]?.disabled,
    [buttonStates]
  );

  const focusActiveEditor = useCallback(() => {
    const isSource = useEditorStore.getState().sourceMode;
    if (isSource) {
      useSourceCursorContextStore.getState().editorView?.focus();
      return;
    }
    useTiptapEditorStore.getState().editorView?.focus();
  }, []);

  const closeMenu = useCallback((restoreFocus = true) => {
    setMenuOpen(false);
    setOpenGroupId(null);
    if (!restoreFocus || !useUIStore.getState().universalToolbarVisible) return;
    requestAnimationFrame(() => {
      if (!useUIStore.getState().universalToolbarVisible) return;
      const currentIndex = useUIStore.getState().lastFocusedToolbarIndex;
      const target = containerRef.current?.querySelector<HTMLButtonElement>(
        `.universal-toolbar-btn[data-focus-index="${currentIndex}"]`
      );
      target?.focus();
    });
  }, []);

  const handleAction = useCallback((action: string) => {
    if (action.startsWith("heading:")) {
      const level = Number(action.split(":")[1]);
      if (Number.isNaN(level)) return;
      const isSource = useEditorStore.getState().sourceMode;
      if (isSource) {
        const state = useSourceCursorContextStore.getState();
        setSourceHeadingLevel({ surface: "source", view: state.editorView, context: state.context }, level);
      } else {
        const state = useTiptapEditorStore.getState();
        setWysiwygHeadingLevel({ surface: "wysiwyg", view: state.editorView, editor: state.editor, context: state.context }, level);
      }
      return;
    }

    const isSource = useEditorStore.getState().sourceMode;
    if (isSource) {
      const state = useSourceCursorContextStore.getState();
      performSourceToolbarAction(action, {
        surface: "source",
        view: state.editorView,
        context: state.context,
      });
      return;
    }

    const state = useTiptapEditorStore.getState();
    performWysiwygToolbarAction(action, {
      surface: "wysiwyg",
      view: state.editorView,
      editor: state.editor,
      context: state.context,
    });
  }, []);

  // Keyboard navigation
  const { handleKeyDown, focusedIndex, setFocusedIndex } = useToolbarKeyboard({
    buttonCount: buttons.length,
    containerRef,
    isButtonFocusable,
    onActivate: (index) => {
      const button = buttons[index];
      if (!button) return;
      if (button.type === "dropdown") {
        if (buttonStates[index]?.disabled) return;
        const rect = containerRef.current?.querySelector<HTMLButtonElement>(
          `.universal-toolbar-btn[data-focus-index="${index}"]`
        )?.getBoundingClientRect();
        if (rect) {
          setMenuAnchor(rect);
          setOpenGroupId(button.id);
          setMenuOpen(true);
        }
      }
    },
    onOpenDropdown: (index) => {
      const button = buttons[index];
      if (!button || button.type !== "dropdown") return false;
      if (buttonStates[index]?.disabled) return false;
      const rect = containerRef.current?.querySelector<HTMLButtonElement>(
        `.universal-toolbar-btn[data-focus-index="${index}"]`
      )?.getBoundingClientRect();
      if (rect) {
        setMenuAnchor(rect);
        setOpenGroupId(button.id);
        setMenuOpen(true);
      }
      return true;
    },
    onClose: () => {
      useUIStore.getState().setUniversalToolbarVisible(false);
      focusActiveEditor();
      closeMenu(false);
    },
  });

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      closeMenu(false);
      return;
    }

    if (!wasVisibleRef.current) {
      const initialIndex = getInitialFocusIndex({
        buttons,
        states: buttonStates,
        lastFocusedIndex,
        context: toolbarContext,
      });
      setFocusedIndex(initialIndex);
    }

    wasVisibleRef.current = true;
  }, [visible, buttons, buttonStates, lastFocusedIndex, toolbarContext, setFocusedIndex, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        closeMenu();
      }
    };

    const handleKeyDownEvent = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDownEvent);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDownEvent);
    };
  }, [menuOpen, closeMenu]);

  const openGroup = openGroupId
    ? TOOLBAR_GROUPS.find((group) => group.id === openGroupId) ?? null
    : null;

  const dropdownItems = useMemo(() => {
    if (!openGroup) return [];
    return openGroup.items.map((item) => ({
      item,
      state: getToolbarItemState(item, toolbarContext),
    }));
  }, [openGroup, toolbarContext]);

  if (!visible) {
    return null;
  }

  // Build flat index for roving tabindex
  let flatIndex = 0;

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Formatting toolbar"
      className="universal-toolbar"
      onKeyDown={handleKeyDown}
    >
      {TOOLBAR_GROUPS.map((group, groupIndex) => (
        <div key={group.id} className="universal-toolbar-group">
          {(() => {
            const button = buttons[flatIndex];
            if (!button) return null;

            const currentIndex = flatIndex++;
            const state = buttonStates[currentIndex];
            const disabled = state?.disabled ?? true;
            const notImplemented = state?.notImplemented ?? false;
            const active = state?.active ?? false;

            return (
              <ToolbarButton
                key={button.id}
                button={button}
                disabled={disabled}
                notImplemented={notImplemented}
                active={active}
                focusIndex={currentIndex}
                currentFocusIndex={focusedIndex}
                onClick={() => {
                  if (button.type === "dropdown") {
                    const rect = containerRef.current?.querySelector<HTMLButtonElement>(
                      `.universal-toolbar-btn[data-focus-index="${currentIndex}"]`
                    )?.getBoundingClientRect();
                    if (rect) {
                      setMenuAnchor(rect);
                      setOpenGroupId(button.id);
                      setMenuOpen(true);
                    }
                  }
                }}
              />
            );
          })()}
        </div>
      ))}

      {menuOpen && menuAnchor && openGroup && (
        <GroupDropdown
          ref={menuRef}
          anchorRect={menuAnchor}
          items={dropdownItems}
          onSelect={(action) => {
            handleAction(action);
            closeMenu();
          }}
          onClose={() => closeMenu()}
        />
      )}
    </div>
  );
}
