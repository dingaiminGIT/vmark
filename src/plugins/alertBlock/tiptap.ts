import { Node } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";

export const ALERT_TYPES = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    alertBlock: {
      insertAlertBlock: (alertType?: AlertType) => ReturnType;
    };
  }
}

function createAlertBlockNode(state: EditorState, alertType: AlertType) {
  const nodeType = state.schema.nodes.alertBlock;
  const paragraphType = state.schema.nodes.paragraph;
  if (!nodeType || !paragraphType) return null;
  return nodeType.create({ alertType }, [paragraphType.create()]);
}

export const alertBlockExtension = Node.create({
  name: "alertBlock",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      alertType: {
        default: "NOTE",
        parseHTML: (element) => {
          const value = (element as HTMLElement).getAttribute("data-alert-type")?.toUpperCase() ?? "NOTE";
          return ALERT_TYPES.includes(value as AlertType) ? value : "NOTE";
        },
        renderHTML: (attributes) => {
          const value = (attributes.alertType as string | undefined) ?? "NOTE";
          return { "data-alert-type": value };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-alert-type]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const alertType = ((node.attrs.alertType as string | undefined) ?? "NOTE").toLowerCase();
    return [
      "div",
      {
        ...HTMLAttributes,
        class: `alert-block alert-${alertType}`,
      },
      ["div", { class: "alert-title", contenteditable: "false" }, String(node.attrs.alertType ?? "NOTE")],
      ["div", { class: "alert-content" }, 0],
    ];
  },

  addCommands() {
    return {
      insertAlertBlock:
        (alertType = "NOTE") =>
        ({ state, dispatch }) => {
          const alertNode = createAlertBlockNode(state, alertType);
          if (!alertNode) return false;

          const { $from } = state.selection;
          const insertPos = $from.end($from.depth) + 1;

          if (!dispatch) return true;

          const tr = state.tr.insert(insertPos, alertNode);
          tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 2)));
          dispatch(tr.scrollIntoView());
          return true;
        },
    };
  },
});
