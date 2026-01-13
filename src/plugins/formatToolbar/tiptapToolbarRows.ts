import type { EditorView } from "@tiptap/pm/view";
import type { ContextMode } from "@/stores/formatToolbarStore";
import { getQuickLabel, getRecentLanguages, QUICK_LANGUAGES } from "@/plugins/sourceFormatPopup/languages";
import { toggleTiptapLanguageMenu } from "./tiptapLanguageMenu";
import { TIPTAP_FORMAT_BUTTONS, tiptapToolbarIcons } from "./tiptapUi";
import { createToolbarButton, createToolbarRow } from "./tiptapToolbarDom";

export type ListAction = "indent" | "outdent" | "bullet" | "ordered" | "remove";
export type InsertAction = "image" | "table" | "unordered-list" | "ordered-list" | "blockquote" | "divider";
export type QuoteAction = "nest" | "unnest" | "remove";

export function buildFormatRow(
  editorView: EditorView,
  onFormat: (markType: string) => void
): HTMLElement {
  const row = createToolbarRow();
  for (const btn of TIPTAP_FORMAT_BUTTONS) {
    if (!editorView.state.schema.marks[btn.markType]) continue;
    row.appendChild(
      createToolbarButton({
        icon: btn.icon,
        title: btn.title,
        shortcut: btn.shortcut,
        shortcutKey: btn.shortcutKey ?? undefined,
        onClick: () => onFormat(btn.markType),
      })
    );
  }
  return row;
}

export function buildListRow(onListAction: (action: ListAction) => void): HTMLElement {
  const row = createToolbarRow();
  row.appendChild(
    createToolbarButton({
      icon: tiptapToolbarIcons.indent,
      title: "Indent",
      onClick: () => onListAction("indent"),
    })
  );
  row.appendChild(
    createToolbarButton({
      icon: tiptapToolbarIcons.outdent,
      title: "Outdent",
      onClick: () => onListAction("outdent"),
    })
  );
  row.appendChild(
    createToolbarButton({
      icon: tiptapToolbarIcons.bulletList,
      title: "Bullet List",
      onClick: () => onListAction("bullet"),
    })
  );
  row.appendChild(
    createToolbarButton({
      icon: tiptapToolbarIcons.orderedList,
      title: "Ordered List",
      onClick: () => onListAction("ordered"),
    })
  );
  row.appendChild(
    createToolbarButton({
      icon: tiptapToolbarIcons.removeList,
      title: "Remove List",
      onClick: () => onListAction("remove"),
    })
  );
  return row;
}

export function buildInsertRow(
  contextMode: ContextMode,
  onInsertAction: (action: InsertAction) => void
): HTMLElement {
  const row = createToolbarRow();
  const addButton = (icon: string, title: string, action: InsertAction) => {
    row.appendChild(createToolbarButton({ icon, title, onClick: () => onInsertAction(action) }));
  };

  addButton(tiptapToolbarIcons.image, "Insert Image", "image");
  addButton(tiptapToolbarIcons.table, "Insert Table", "table");
  addButton(tiptapToolbarIcons.bulletList, "Bullet List", "unordered-list");
  addButton(tiptapToolbarIcons.orderedList, "Ordered List", "ordered-list");
  addButton(tiptapToolbarIcons.blockquote, "Blockquote", "blockquote");
  if (contextMode === "block-insert") {
    addButton(tiptapToolbarIcons.divider, "Divider", "divider");
  }

  return row;
}

export function buildBlockquoteRow(onQuoteAction: (action: QuoteAction) => void): HTMLElement {
  const row = createToolbarRow();
  row.appendChild(
    createToolbarButton({
      icon: tiptapToolbarIcons.nestQuote,
      title: "Nest",
      onClick: () => onQuoteAction("nest"),
    })
  );
  row.appendChild(
    createToolbarButton({
      icon: tiptapToolbarIcons.unnestQuote,
      title: "Unnest",
      onClick: () => onQuoteAction("unnest"),
    })
  );
  row.appendChild(
    createToolbarButton({
      icon: tiptapToolbarIcons.removeQuote,
      title: "Remove",
      onClick: () => onQuoteAction("remove"),
    })
  );
  return row;
}

export function buildCodeRow(
  currentLang: string,
  onLanguageChange: (language: string) => void
): HTMLElement {
  const row = createToolbarRow();
  row.classList.add("format-toolbar-quick-langs");

  const quick = QUICK_LANGUAGES.map((l) => l.name);
  const recent = getRecentLanguages().filter((l) => !quick.includes(l));
  const merged = [...quick, ...recent].slice(0, 8);

  for (const lang of merged) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `format-toolbar-quick-btn${lang === currentLang ? " active" : ""}`;
    btn.textContent = getQuickLabel(lang);
    btn.title = lang;
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onLanguageChange(lang);
    });
    row.appendChild(btn);
  }

  const dropdown = document.createElement("div");
  dropdown.className = "format-toolbar-dropdown";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "format-toolbar-btn format-toolbar-dropdown-trigger";
  trigger.innerHTML = `<span class="format-toolbar-lang-label">${currentLang || "lang"}</span>${tiptapToolbarIcons.chevronDown}`;
  trigger.addEventListener("mousedown", (e) => e.preventDefault());
  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleTiptapLanguageMenu({ dropdown, onSelect: onLanguageChange });
  });
  dropdown.appendChild(trigger);
  row.appendChild(dropdown);

  return row;
}
