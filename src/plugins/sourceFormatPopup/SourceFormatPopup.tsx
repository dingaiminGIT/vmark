/**
 * Source Format Popup Component
 *
 * Floating toolbar for markdown formatting and table editing in source mode.
 * Shows format buttons when text is selected, table buttons when in a table.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useSourceFormatStore } from "@/stores/sourceFormatStore";
import { icons, createIcon } from "@/utils/icons";
import {
  calculatePopupPosition,
  getBoundaryRects,
  getViewportBounds,
  type PopupPosition,
} from "@/utils/popupPosition";
import { applyFormat, hasFormat, type FormatType } from "./formatActions";
import {
  insertRowAbove,
  insertRowBelow,
  insertColumnLeft,
  insertColumnRight,
  deleteRow,
  deleteColumn,
  deleteTable,
} from "./tableDetection";
import { setHeadingLevel, convertToHeading } from "./headingDetection";
import "./source-format.css";

interface FormatButton {
  type: FormatType;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
}

const FORMAT_BUTTONS: FormatButton[] = [
  { type: "bold", icon: createIcon(icons.bold), label: "Bold", shortcut: "⌘B" },
  { type: "italic", icon: createIcon(icons.italic), label: "Italic", shortcut: "⌘I" },
  { type: "code", icon: createIcon(icons.inlineCode), label: "Code", shortcut: "⌘E" },
  { type: "strikethrough", icon: createIcon(icons.strikethrough), label: "Strikethrough", shortcut: "⌘⇧X" },
  { type: "highlight", icon: createIcon(icons.highlight), label: "Highlight", shortcut: "⌘⇧H" },
  { type: "superscript", icon: createIcon(icons.superscript), label: "Superscript", shortcut: "⌘⇧." },
  { type: "subscript", icon: createIcon(icons.subscript), label: "Subscript", shortcut: "⌘." },
  { type: "link", icon: createIcon(icons.link), label: "Link", shortcut: "⌘K" },
  { type: "image", icon: createIcon(icons.image), label: "Image", shortcut: "⌘⇧I" },
  { type: "footnote", icon: createIcon(icons.footnote), label: "Footnote", shortcut: "⌘⇧F" },
];

interface TableButtonDef {
  id: string;
  icon: React.ReactNode;
  label: string;
  action: "rowAbove" | "rowBelow" | "colLeft" | "colRight" | "deleteRow" | "deleteCol" | "deleteTable";
  variant?: "danger";
}

const TABLE_BUTTONS: TableButtonDef[] = [
  { id: "rowAbove", icon: createIcon(icons.rowAbove), label: "Insert row above", action: "rowAbove" },
  { id: "rowBelow", icon: createIcon(icons.rowBelow), label: "Insert row below", action: "rowBelow" },
  { id: "colLeft", icon: createIcon(icons.colLeft), label: "Insert column left", action: "colLeft" },
  { id: "colRight", icon: createIcon(icons.colRight), label: "Insert column right", action: "colRight" },
  { id: "deleteRow", icon: createIcon(icons.deleteRow), label: "Delete row", action: "deleteRow" },
  { id: "deleteCol", icon: createIcon(icons.deleteCol), label: "Delete column", action: "deleteCol" },
  { id: "deleteTable", icon: createIcon(icons.deleteTable), label: "Delete table", action: "deleteTable" },
];

interface HeadingButtonDef {
  level: number;
  icon: React.ReactNode;
  label: string;
}

const HEADING_BUTTONS: HeadingButtonDef[] = [
  { level: 1, icon: createIcon(icons.heading1), label: "Heading 1" },
  { level: 2, icon: createIcon(icons.heading2), label: "Heading 2" },
  { level: 3, icon: createIcon(icons.heading3), label: "Heading 3" },
  { level: 4, icon: createIcon(icons.heading4), label: "Heading 4" },
  { level: 5, icon: createIcon(icons.heading5), label: "Heading 5" },
  { level: 6, icon: createIcon(icons.heading6), label: "Heading 6" },
  { level: 0, icon: createIcon(icons.paragraph), label: "Paragraph" },
];

export function SourceFormatPopup() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PopupPosition | null>(null);
  const [activeFormats, setActiveFormats] = useState<Set<FormatType>>(new Set());
  const [headingDropdownOpen, setHeadingDropdownOpen] = useState(false);
  const justOpenedRef = useRef(false);

  const isOpen = useSourceFormatStore((state) => state.isOpen);
  const mode = useSourceFormatStore((state) => state.mode);
  const anchorRect = useSourceFormatStore((state) => state.anchorRect);
  const editorView = useSourceFormatStore((state) => state.editorView);
  const tableInfo = useSourceFormatStore((state) => state.tableInfo);
  const headingInfo = useSourceFormatStore((state) => state.headingInfo);

  // Calculate position when popup opens or anchor changes
  useEffect(() => {
    if (!isOpen || !anchorRect || !containerRef.current || !editorView) {
      setPosition(null);
      return;
    }

    // Measure popup dimensions
    const popup = containerRef.current;
    const width = popup.offsetWidth || 200;
    const height = popup.offsetHeight || 36;

    // Get boundaries: horizontal from CodeMirror dom, vertical from editor container
    const cmDom = editorView.dom as HTMLElement;
    const containerEl = cmDom.closest(".editor-container") as HTMLElement;
    const bounds = containerEl
      ? getBoundaryRects(cmDom, containerEl)
      : getViewportBounds();

    const pos = calculatePopupPosition({
      anchor: anchorRect,
      popup: { width, height },
      bounds,
      gap: 8,
      preferAbove: true,
    });

    setPosition(pos);

    // Mark as just opened
    justOpenedRef.current = true;
    requestAnimationFrame(() => {
      justOpenedRef.current = false;
    });
  }, [isOpen, anchorRect, mode, editorView]);

  // Update active formats when editor view changes (only in format mode)
  useEffect(() => {
    if (!isOpen || !editorView || mode !== "format") {
      setActiveFormats(new Set());
      return;
    }

    const formats = new Set<FormatType>();
    FORMAT_BUTTONS.forEach(({ type }) => {
      if (hasFormat(editorView, type)) {
        formats.add(type);
      }
    });
    setActiveFormats(formats);
  }, [isOpen, editorView, mode]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Prevent closing on same click that opened
      if (justOpenedRef.current) return;

      const popup = containerRef.current;
      if (popup && !popup.contains(e.target as Node)) {
        useSourceFormatStore.getState().closePopup();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        useSourceFormatStore.getState().closePopup();
        editorView?.focus();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, editorView]);

  const handleFormat = useCallback(
    (type: FormatType) => {
      if (!editorView) return;

      applyFormat(editorView, type);

      // Close popup after formatting (selection changes)
      useSourceFormatStore.getState().closePopup();
    },
    [editorView]
  );

  const handleTableAction = useCallback(
    (action: TableButtonDef["action"]) => {
      if (!editorView || !tableInfo) return;

      // Re-fetch table info to ensure it's current
      const info = tableInfo;

      switch (action) {
        case "rowAbove":
          insertRowAbove(editorView, info);
          break;
        case "rowBelow":
          insertRowBelow(editorView, info);
          break;
        case "colLeft":
          insertColumnLeft(editorView, info);
          break;
        case "colRight":
          insertColumnRight(editorView, info);
          break;
        case "deleteRow":
          deleteRow(editorView, info);
          break;
        case "deleteCol":
          deleteColumn(editorView, info);
          break;
        case "deleteTable":
          deleteTable(editorView, info);
          useSourceFormatStore.getState().closePopup();
          break;
      }
    },
    [editorView, tableInfo]
  );

  const handleHeadingLevel = useCallback(
    (level: number) => {
      if (!editorView || !headingInfo) return;

      setHeadingLevel(editorView, headingInfo, level);
      useSourceFormatStore.getState().closePopup();
    },
    [editorView, headingInfo]
  );

  const handleConvertToHeading = useCallback(
    (level: number) => {
      if (!editorView) return;

      convertToHeading(editorView, level);
      setHeadingDropdownOpen(false);
      useSourceFormatStore.getState().closePopup();
    },
    [editorView]
  );

  // Close dropdown when popup closes
  useEffect(() => {
    if (!isOpen) {
      setHeadingDropdownOpen(false);
    }
  }, [isOpen]);

  // Don't render if not open
  if (!isOpen) return null;

  const popup = (
    <div
      ref={containerRef}
      className={`source-format-popup source-format-popup--${mode}`}
      style={{
        visibility: position ? "visible" : "hidden",
        top: position?.top ?? 0,
        left: position?.left ?? 0,
      }}
    >
      {mode === "format" ? (
        // Format buttons for text selection
        <>
          {FORMAT_BUTTONS.map(({ type, icon, label, shortcut }) => (
            <button
              key={type}
              type="button"
              className={`source-format-btn ${activeFormats.has(type) ? "active" : ""}`}
              title={`${label} (${shortcut})`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleFormat(type)}
            >
              {icon}
            </button>
          ))}
          <div className="source-format-separator" />
          <div className="source-format-dropdown">
            <button
              type="button"
              className={`source-format-btn source-format-dropdown-trigger ${headingDropdownOpen ? "active" : ""}`}
              title="Heading"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setHeadingDropdownOpen(!headingDropdownOpen)}
            >
              {createIcon(icons.heading)}
              {createIcon(icons.chevronDown, 12)}
            </button>
            {headingDropdownOpen && (
              <div className="source-format-dropdown-menu">
                {HEADING_BUTTONS.slice(0, 6).map(({ level, icon, label }) => (
                  <button
                    key={level}
                    type="button"
                    className="source-format-dropdown-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleConvertToHeading(level)}
                  >
                    {icon}
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : mode === "table" ? (
        // Table buttons when cursor is in table
        TABLE_BUTTONS.map(({ id, icon, label, action, variant }) => (
          <button
            key={id}
            type="button"
            className={`source-format-btn ${variant === "danger" ? "danger" : ""}`}
            title={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleTableAction(action)}
          >
            {icon}
          </button>
        ))
      ) : (
        // Heading buttons when selection is in a heading
        HEADING_BUTTONS.map(({ level, icon, label }) => (
          <button
            key={level}
            type="button"
            className={`source-format-btn ${headingInfo?.level === level ? "active" : ""}`}
            title={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleHeadingLevel(level)}
          >
            {icon}
          </button>
        ))
      )}
    </div>
  );

  return createPortal(popup, document.body);
}

export default SourceFormatPopup;
