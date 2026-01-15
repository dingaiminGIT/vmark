import type { EditorView as TiptapEditorView } from "@tiptap/pm/view";
import type { ToolbarButton } from "@/components/Editor/UniversalToolbar/toolbarGroups";
import type { CursorContext as WysiwygContext } from "@/plugins/toolbarContext/types";
import type { CursorContext as SourceContext } from "@/types/cursorContext";
import type { ToolbarContext } from "./types";

interface ToolbarButtonState {
  disabled: boolean;
  notImplemented: boolean;
  active: boolean;
}

const SOURCE_UNIMPLEMENTED_ACTIONS = new Set<string>([
  "underline",
  "clearFormatting",
  "insertDetails",
  "insertAlert",
  "insertMath",
]);

const SOURCE_SELECTION_REQUIRED_ACTIONS = new Set<string>([
  "bold",
  "italic",
  "strikethrough",
  "highlight",
  "superscript",
  "subscript",
  "code",
  "underline",
  "clearFormatting",
  "insertFootnote",
]);

function isWysiwygMarkActive(view: TiptapEditorView, markName: string): boolean {
  const { state } = view;
  const markType = state.schema.marks[markName];
  if (!markType) return false;

  const { from, to, empty } = state.selection;
  if (empty) {
    const marks = state.storedMarks || state.selection.$from.marks();
    return Boolean(markType.isInSet(marks));
  }

  return state.doc.rangeHasMark(from, to, markType);
}

function isWysiwygActionActive(action: string, context: WysiwygContext | null, view: TiptapEditorView | null): boolean {
  if (!context || !view) return false;

  switch (action) {
    case "bold":
      return isWysiwygMarkActive(view, "bold");
    case "italic":
      return isWysiwygMarkActive(view, "italic");
    case "underline":
      return isWysiwygMarkActive(view, "underline");
    case "strikethrough":
      return isWysiwygMarkActive(view, "strike");
    case "highlight":
      return isWysiwygMarkActive(view, "highlight");
    case "superscript":
      return isWysiwygMarkActive(view, "superscript");
    case "subscript":
      return isWysiwygMarkActive(view, "subscript");
    case "code":
      return isWysiwygMarkActive(view, "code");
    case "link":
      return Boolean(context.inLink) || isWysiwygMarkActive(view, "link");
    case "bulletList":
      return context.inList?.listType === "bullet";
    case "orderedList":
      return context.inList?.listType === "ordered";
    case "taskList":
      return context.inList?.listType === "task";
    case "heading":
      return Boolean(context.inHeading);
    default:
      return false;
  }
}

function isSourceActionActive(action: string, context: SourceContext | null): boolean {
  if (!context) return false;

  switch (action) {
    case "bold":
    case "italic":
    case "strikethrough":
    case "highlight":
    case "superscript":
    case "subscript":
    case "code":
      return context.activeFormats.includes(action as SourceContext["activeFormats"][number]);
    case "link":
      return Boolean(context.inLink);
    case "bulletList":
      return context.inList?.type === "bullet";
    case "orderedList":
      return context.inList?.type === "ordered";
    case "taskList":
      return context.inList?.type === "task";
    case "heading":
      return Boolean(context.inHeading);
    default:
      return false;
  }
}

function matchesEnabledContext(enabled: ToolbarButton["enabledIn"], ctx: WysiwygContext | SourceContext | null): boolean {
  if (!ctx) return false;

  for (const rule of enabled) {
    switch (rule) {
      case "always":
        return true;
      case "selection":
        if (ctx.hasSelection) return true;
        break;
      case "textblock":
        if (!ctx.inCodeBlock) return true;
        break;
      case "heading":
        if (ctx.inHeading) return true;
        break;
      case "list":
        if (ctx.inList) return true;
        break;
      case "table":
        if (ctx.inTable) return true;
        break;
      case "blockquote":
        if (ctx.inBlockquote) return true;
        break;
      case "codeblock":
        if (ctx.inCodeBlock) return true;
        break;
      case "never":
        break;
    }
  }

  return false;
}

function isActionImplemented(action: string, surface: ToolbarContext["surface"]): boolean {
  if (surface === "source") {
    return !SOURCE_UNIMPLEMENTED_ACTIONS.has(action);
  }

  return true;
}

function shouldRequireSelection(action: string, surface: ToolbarContext["surface"]): boolean {
  if (surface === "source") {
    return SOURCE_SELECTION_REQUIRED_ACTIONS.has(action);
  }
  return false;
}

export function getToolbarButtonState(
  button: ToolbarButton,
  context: ToolbarContext
): ToolbarButtonState {
  const { surface } = context;
  const notImplemented = button.enabledIn.includes("never") || !isActionImplemented(button.action, surface);

  const ctx = context.context;
  const view = context.view;

  if (!view || !ctx) {
    return { disabled: true, notImplemented, active: false };
  }

  const enabled = matchesEnabledContext(button.enabledIn, ctx) &&
    (!shouldRequireSelection(button.action, surface) || ctx.hasSelection);

  const active = surface === "wysiwyg"
    ? isWysiwygActionActive(
        button.action,
        ctx as WysiwygContext,
        (view as TiptapEditorView | null)
      )
    : isSourceActionActive(button.action, ctx as SourceContext);

  return {
    disabled: !enabled || notImplemented,
    notImplemented,
    active,
  };
}
