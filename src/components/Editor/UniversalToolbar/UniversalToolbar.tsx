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
import { getToolbarButtonState } from "@/plugins/toolbarActions/enableRules";
import { performSourceToolbarAction, setSourceHeadingLevel } from "@/plugins/toolbarActions/sourceAdapter";
import { performWysiwygToolbarAction, setWysiwygHeadingLevel } from "@/plugins/toolbarActions/wysiwygAdapter";
import type { ToolbarContext } from "@/plugins/toolbarActions/types";
import { TOOLBAR_GROUPS, getAllButtons } from "./toolbarGroups";
import { ToolbarButton } from "./ToolbarButton";
import { useToolbarKeyboard } from "./useToolbarKeyboard";
import { getInitialFocusIndex } from "./toolbarFocus";
import { HeadingDropdown } from "./HeadingDropdown";
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

  const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
  const [headingMenuAnchor, setHeadingMenuAnchor] = useState<DOMRect | null>(null);
  const headingMenuRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wasVisibleRef = useRef(false);

  // Get flat button list for navigation (excludes separators)
  const buttons = useMemo(
    () => getAllButtons().filter((b) => b.type !== "separator"),
    []
  );
  const headingButtonIndex = useMemo(
    () => buttons.findIndex((button) => button.action === "heading"),
    [buttons]
  );

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

  const handleAction = useCallback((action: string) => {
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

  const focusHeadingButton = useCallback(() => {
    if (headingButtonIndex < 0) return;
    const target = containerRef.current?.querySelector<HTMLButtonElement>(
      `.universal-toolbar-btn[data-focus-index="${headingButtonIndex}"]`
    );
    target?.focus();
  }, [headingButtonIndex, containerRef]);

  const closeHeadingMenu = useCallback((restoreFocus = true) => {
    setHeadingMenuOpen(false);
    if (!restoreFocus || !useUIStore.getState().universalToolbarVisible) return;
    requestAnimationFrame(() => {
      if (!useUIStore.getState().universalToolbarVisible) return;
      focusHeadingButton();
    });
  }, [focusHeadingButton]);

  const handleHeadingSelect = useCallback((level: number) => {
    const isSource = useEditorStore.getState().sourceMode;
    if (isSource) {
      const state = useSourceCursorContextStore.getState();
      setSourceHeadingLevel({ surface: "source", view: state.editorView, context: state.context }, level);
    } else {
      const state = useTiptapEditorStore.getState();
      setWysiwygHeadingLevel({ surface: "wysiwyg", view: state.editorView, editor: state.editor, context: state.context }, level);
    }
    closeHeadingMenu();
  }, [closeHeadingMenu]);

  // Keyboard navigation
  const { handleKeyDown, focusedIndex, setFocusedIndex } = useToolbarKeyboard({
    buttonCount: buttons.length,
    containerRef,
    isButtonFocusable,
    onActivate: (index) => {
      const button = buttons[index];
      if (!button) return;
      if (button.type === "dropdown" && button.action === "heading") {
        const rect = containerRef.current?.querySelector<HTMLButtonElement>(
          `.universal-toolbar-btn[data-focus-index="${index}"]`
        )?.getBoundingClientRect();
        if (rect) {
          setHeadingMenuAnchor(rect);
          setHeadingMenuOpen(true);
        }
        return;
      }
      handleAction(button.action);
    },
    onOpenDropdown: (index) => {
      const button = buttons[index];
      if (!button || button.type !== "dropdown") return false;
      if (button.action === "heading") {
        const rect = containerRef.current?.querySelector<HTMLButtonElement>(
          `.universal-toolbar-btn[data-focus-index="${index}"]`
        )?.getBoundingClientRect();
        if (rect) {
          setHeadingMenuAnchor(rect);
          setHeadingMenuOpen(true);
        }
        return true;
      }
      if (button.action === "link") {
        handleAction(button.action);
        return true;
      }
      return false;
    },
    onClose: () => {
      useUIStore.getState().setUniversalToolbarVisible(false);
      focusActiveEditor();
      closeHeadingMenu(false);
    },
  });

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      setHeadingMenuOpen(false);
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
  }, [visible, buttons, buttonStates, lastFocusedIndex, toolbarContext, setFocusedIndex]);

  useEffect(() => {
    if (!headingMenuOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (headingMenuRef.current && !headingMenuRef.current.contains(target)) {
        closeHeadingMenu();
      }
    };

    const handleKeyDownEvent = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeHeadingMenu();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDownEvent);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDownEvent);
    };
  }, [headingMenuOpen, closeHeadingMenu]);

  if (!visible) {
    return null;
  }

  // Build flat index for roving tabindex
  let flatIndex = 0;

  const headingLevel = sourceMode
    ? sourceContext?.inHeading?.level ?? 0
    : wysiwygContext?.inHeading?.level ?? 0;

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
          {group.buttons.map((button) => {
            // Skip separators for now
            if (button.type === "separator") return null;

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
                  if (button.type === "dropdown" && button.action === "heading") {
                    const rect = containerRef.current?.querySelector<HTMLButtonElement>(
                      `.universal-toolbar-btn[data-focus-index="${currentIndex}"]`
                    )?.getBoundingClientRect();
                    if (rect) {
                      setHeadingMenuAnchor(rect);
                      setHeadingMenuOpen(true);
                    }
                    return;
                  }
                  handleAction(button.action);
                }}
              />
            );
          })}
          {/* Separator between groups (except last) */}
          {groupIndex < TOOLBAR_GROUPS.length - 1 && (
            <div className="universal-toolbar-separator" />
          )}
        </div>
      ))}

      {headingMenuOpen && headingMenuAnchor && (
        <HeadingDropdown
          ref={headingMenuRef}
          anchorRect={headingMenuAnchor}
          currentLevel={headingLevel}
          onSelect={handleHeadingSelect}
          onClose={() => closeHeadingMenu()}
        />
      )}
    </div>
  );
}
