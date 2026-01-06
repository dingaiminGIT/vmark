import { emit } from "@tauri-apps/api/event";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { convertSelectionToTaskList } from "@/plugins/taskToggle/tiptapTaskListUtils";
import { insertFootnoteAndOpenPopup } from "@/plugins/footnotePopup/tiptapInsertFootnote";
import type { SlashMenuItem } from "./tiptapSlashMenuUtils";

const icons = {
  paragraph: `<svg viewBox="0 0 24 24"><path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 1 0 0 9H13"/></svg>`,
  heading1: `<svg viewBox="0 0 24 24"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="m17 12 3-2v8"/></svg>`,
  heading2: `<svg viewBox="0 0 24 24"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>`,
  heading3: `<svg viewBox="0 0 24 24"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/></svg>`,
  heading4: `<svg viewBox="0 0 24 24"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 10v4h4"/><path d="M21 10v8"/></svg>`,
  heading5: `<svg viewBox="0 0 24 24"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 18h4c0-3-4-4-4-7h4"/></svg>`,
  heading6: `<svg viewBox="0 0 24 24"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><circle cx="19" cy="16" r="2"/><path d="M20 10c-2 0-3 1.5-3 4"/></svg>`,
  quote: `<svg viewBox="0 0 24 24"><path d="M17 6H3"/><path d="M21 12H8"/><path d="M21 18H8"/><path d="M3 12v6"/></svg>`,
  minus: `<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>`,
  list: `<svg viewBox="0 0 24 24"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`,
  listOrdered: `<svg viewBox="0 0 24 24"><line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>`,
  listTodo: `<svg viewBox="0 0 24 24"><rect width="6" height="6" x="3" y="5" rx="1"/><path d="m3 17 2 2 4-4"/><line x1="13" x2="21" y1="6" y2="6"/><line x1="13" x2="21" y1="12" y2="12"/><line x1="13" x2="21" y1="18" y2="18"/></svg>`,
  image: `<svg viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
  code: `<svg viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  table: `<svg viewBox="0 0 24 24"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>`,
  sigma: `<svg viewBox="0 0 24 24"><path d="M18 7V4H6l6 8-6 8h12v-3"/></svg>`,
  diagram: `<svg viewBox="0 0 24 24"><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`,
  footnote: `<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M12 4h9"/><path d="M4 12h9"/><path d="M4 7V4h3"/><path d="M4 20v-3h3"/></svg>`,
  bold: `<svg viewBox="0 0 24 24"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/></svg>`,
  italic: `<svg viewBox="0 0 24 24"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>`,
  strikethrough: `<svg viewBox="0 0 24 24"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/></svg>`,
  inlineCode: `<svg viewBox="0 0 24 24"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>`,
  highlight: `<svg viewBox="0 0 24 24"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>`,
  subscript: `<svg viewBox="0 0 24 24"><path d="m4 5 8 8"/><path d="m12 5-8 8"/><path d="M20 19h-4c0-1.5.44-2 1.5-2.5S20 15.33 20 14c0-.47-.17-.93-.48-1.29a2.11 2.11 0 0 0-2.62-.44c-.42.24-.74.62-.9 1.07"/></svg>`,
  superscript: `<svg viewBox="0 0 24 24"><path d="m4 19 8-8"/><path d="m12 19-8-8"/><path d="M20 12h-4c0-1.5.442-2 1.5-2.5S20 8.334 20 7c0-.472-.167-.933-.48-1.29a2.105 2.105 0 0 0-2.617-.436c-.42.239-.738.614-.903 1.06"/></svg>`,
};

const defaultMermaid = ["flowchart TD", "    A[Start] --> B[End]"].join("\n");
const defaultMath = "c = \\pm\\sqrt{a^2 + b^2}";

export function createSlashMenuItems(editor: TiptapEditor): SlashMenuItem[] {
  return [
    {
      label: "Text",
      icon: icons.paragraph,
      group: "Text",
      keywords: ["text", "paragraph", "heading", "quote", "h1", "h2", "h3"],
      children: [
        { label: "Paragraph", icon: icons.paragraph, keywords: ["normal", "plain"], action: () => editor.chain().focus().setParagraph().run() },
        { label: "Heading 1", icon: icons.heading1, keywords: ["h1", "title"], action: () => editor.chain().focus().setHeading({ level: 1 }).run() },
        { label: "Heading 2", icon: icons.heading2, keywords: ["h2", "subtitle"], action: () => editor.chain().focus().setHeading({ level: 2 }).run() },
        { label: "Heading 3", icon: icons.heading3, keywords: ["h3"], action: () => editor.chain().focus().setHeading({ level: 3 }).run() },
        { label: "Heading 4", icon: icons.heading4, keywords: ["h4"], action: () => editor.chain().focus().setHeading({ level: 4 }).run() },
        { label: "Heading 5", icon: icons.heading5, keywords: ["h5"], action: () => editor.chain().focus().setHeading({ level: 5 }).run() },
        { label: "Heading 6", icon: icons.heading6, keywords: ["h6"], action: () => editor.chain().focus().setHeading({ level: 6 }).run() },
        { label: "Quote", icon: icons.quote, keywords: ["blockquote", "citation"], action: () => editor.chain().focus().toggleBlockquote().run() },
      ],
    },
    {
      label: "List",
      icon: icons.list,
      group: "List",
      keywords: ["list", "bullet", "numbered", "task", "todo"],
      children: [
        { label: "Bullet List", icon: icons.list, keywords: ["ul", "unordered"], action: () => editor.chain().focus().toggleBulletList().run() },
        { label: "Numbered List", icon: icons.listOrdered, keywords: ["ol", "ordered"], action: () => editor.chain().focus().toggleOrderedList().run() },
        { label: "Task List", icon: icons.listTodo, keywords: ["todo", "checkbox"], action: () => convertSelectionToTaskList(editor) },
      ],
    },
    {
      label: "Format",
      icon: icons.bold,
      group: "Format",
      keywords: ["format", "bold", "italic", "highlight", "code", "strike"],
      children: [
        { label: "Bold", icon: icons.bold, keywords: ["strong"], action: () => editor.chain().focus().toggleBold().run() },
        { label: "Italic", icon: icons.italic, keywords: ["emphasis"], action: () => editor.chain().focus().toggleItalic().run() },
        { label: "Highlight", icon: icons.highlight, keywords: ["mark"], action: () => editor.chain().focus().toggleMark("highlight").run() },
        { label: "Strikethrough", icon: icons.strikethrough, keywords: ["strike"], action: () => editor.chain().focus().toggleStrike().run() },
        { label: "Inline Code", icon: icons.inlineCode, keywords: ["mono", "backtick"], action: () => editor.chain().focus().toggleCode().run() },
        { label: "Subscript", icon: icons.subscript, keywords: ["sub"], action: () => editor.chain().focus().toggleMark("subscript").run() },
        { label: "Superscript", icon: icons.superscript, keywords: ["sup"], action: () => editor.chain().focus().toggleMark("superscript").run() },
      ],
    },
    {
      label: "Advanced",
      icon: icons.code,
      group: "Advanced",
      keywords: ["code", "table", "math", "diagram", "image", "footnote"],
      children: [
        { label: "Image", icon: icons.image, keywords: ["picture", "photo"], action: () => void emit("menu:image") },
        { label: "Code Block", icon: icons.code, keywords: ["pre", "code"], action: () => editor.chain().focus().setCodeBlock().run() },
        { label: "Table", icon: icons.table, keywords: ["grid"], action: () => editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run() },
        {
          label: "Math Block",
          icon: icons.sigma,
          keywords: ["latex", "equation", "katex"],
          action: () =>
            editor
              .chain()
              .focus()
              .insertContent({ type: "codeBlock", attrs: { language: "latex" }, content: [{ type: "text", text: defaultMath }] })
              .run(),
        },
        {
          label: "Mermaid Diagram",
          icon: icons.diagram,
          keywords: ["diagram", "flowchart", "chart"],
          action: () =>
            editor
              .chain()
              .focus()
              .insertContent({ type: "codeBlock", attrs: { language: "mermaid" }, content: [{ type: "text", text: defaultMermaid }] })
              .run(),
        },
        { label: "Footnote", icon: icons.footnote, keywords: ["note", "reference"], action: () => insertFootnoteAndOpenPopup(editor) },
      ],
    },
    { label: "Divider", icon: icons.minus, keywords: ["hr", "line", "separator"], group: "Other", action: () => editor.chain().focus().setHorizontalRule().run() },
  ];
}

