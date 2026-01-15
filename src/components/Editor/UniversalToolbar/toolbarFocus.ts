import type { ToolbarButton } from "./toolbarGroups";
import type { ToolbarContext } from "@/plugins/toolbarActions/types";

interface ToolbarButtonState {
  disabled: boolean;
  notImplemented: boolean;
  active: boolean;
}

interface FocusOptions {
  buttons: ToolbarButton[];
  states: ToolbarButtonState[];
  lastFocusedIndex: number;
  context: ToolbarContext;
}

function findActionIndex(buttons: ToolbarButton[], action: string): number {
  return buttons.findIndex((button) => button.action === action);
}

function isEnabled(states: ToolbarButtonState[], index: number): boolean {
  return index >= 0 && index < states.length && !states[index].disabled;
}

function findFirstEnabled(states: ToolbarButtonState[]): number {
  const index = states.findIndex((state) => !state.disabled);
  return index >= 0 ? index : 0;
}

function findFirstActiveAction(
  buttons: ToolbarButton[],
  states: ToolbarButtonState[],
  actions: string[]
): number | null {
  for (const action of actions) {
    const index = findActionIndex(buttons, action);
    if (isEnabled(states, index) && states[index].active) {
      return index;
    }
  }
  return null;
}

function getListAction(context: ToolbarContext): string {
  if (context.surface === "source") {
    const listType = context.context?.inList?.type;
    if (listType === "ordered") return "orderedList";
    if (listType === "task") return "taskList";
    return "bulletList";
  }

  const listType = context.context?.inList?.listType;
  if (listType === "ordered") return "orderedList";
  if (listType === "task") return "taskList";
  return "bulletList";
}

function isBlankBlock(context: ToolbarContext): boolean {
  if (!context.context) return false;
  if (context.surface === "source") {
    return context.context.contextMode === "block-insert" || context.context.atBlankLine;
  }
  return context.context.contextMode === "insert-block";
}

export function getInitialFocusIndex(options: FocusOptions): number {
  const { buttons, states, lastFocusedIndex, context } = options;

  if (isEnabled(states, lastFocusedIndex)) {
    return lastFocusedIndex;
  }

  const activeFormatPriority = [
    "bold",
    "italic",
    "underline",
    "strikethrough",
    "code",
    "link",
  ];

  const activeIndex = findFirstActiveAction(buttons, states, activeFormatPriority);
  if (activeIndex !== null) {
    return activeIndex;
  }

  if (context.context?.hasSelection) {
    const boldIndex = findActionIndex(buttons, "bold");
    if (isEnabled(states, boldIndex)) return boldIndex;
  }

  if (context.context?.inHeading) {
    const headingIndex = findActionIndex(buttons, "heading");
    if (isEnabled(states, headingIndex)) return headingIndex;
  }

  if (context.context?.inList) {
    const listAction = getListAction(context);
    const listIndex = findActionIndex(buttons, listAction);
    if (isEnabled(states, listIndex)) return listIndex;
  }

  if (context.context?.inTable) {
    const rowIndex = findActionIndex(buttons, "addRow");
    if (isEnabled(states, rowIndex)) return rowIndex;

    const insertTableIndex = findActionIndex(buttons, "insertTable");
    if (isEnabled(states, insertTableIndex)) return insertTableIndex;
  }

  if (context.context?.inBlockquote) {
    const unnestIndex = findActionIndex(buttons, "unnestQuote");
    if (isEnabled(states, unnestIndex)) return unnestIndex;

    const nestIndex = findActionIndex(buttons, "nestQuote");
    if (isEnabled(states, nestIndex)) return nestIndex;
  }

  if (context.context?.inLink) {
    const linkIndex = findActionIndex(buttons, "link");
    if (isEnabled(states, linkIndex)) return linkIndex;
  }

  if (context.context?.inCodeBlock) {
    const codeIndex = findActionIndex(buttons, "insertCodeBlock");
    if (isEnabled(states, codeIndex)) return codeIndex;
  }

  if (isBlankBlock(context)) {
    const headingIndex = findActionIndex(buttons, "heading");
    if (isEnabled(states, headingIndex)) return headingIndex;
  }

  const boldIndex = findActionIndex(buttons, "bold");
  if (isEnabled(states, boldIndex)) return boldIndex;

  return findFirstEnabled(states);
}
