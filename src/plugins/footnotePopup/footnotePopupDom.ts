// Shared DOM + constants for the footnote hover popup.

// SVG Icons
const icons = {
  save: `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
  goto: `<svg viewBox="0 0 24 24"><path d="M12 5v14"/><polyline points="19 12 12 19 5 12"/></svg>`,
};

export const AUTOFOCUS_DELAY_MS = 50;
export const BLUR_CHECK_DELAY_MS = 100;
export const DEFAULT_POPUP_WIDTH = 280;
export const DEFAULT_POPUP_HEIGHT = 80;
export const POPUP_GAP_PX = 8;
export const TEXTAREA_MAX_HEIGHT = 120;

interface FootnotePopupDomHandlers {
  onInputChange: () => void;
  onInputKeydown: (e: KeyboardEvent) => void;
  onTextareaClick: () => void;
  onTextareaBlur: () => void;
  onGoto: () => void;
  onSave: () => void;
}

export function createFootnotePopupDom(handlers: FootnotePopupDomHandlers) {
  const container = document.createElement("div");
  container.className = "footnote-popup";
  container.style.display = "none";

  const textarea = document.createElement("textarea");
  textarea.className = "footnote-popup-textarea";
  textarea.placeholder = "Footnote content...";
  textarea.rows = 2;
  textarea.addEventListener("input", handlers.onInputChange);
  textarea.addEventListener("keydown", handlers.onInputKeydown);
  textarea.addEventListener("click", handlers.onTextareaClick);
  textarea.addEventListener("blur", handlers.onTextareaBlur);
  container.appendChild(textarea);

  const btnRow = document.createElement("div");
  btnRow.className = "footnote-popup-buttons";

  const labelEl = document.createElement("div");
  labelEl.className = "footnote-popup-label";
  btnRow.appendChild(labelEl);

  const spacer = document.createElement("div");
  spacer.style.flex = "1";
  btnRow.appendChild(spacer);

  const gotoBtn = buildIconButton(icons.goto, "Go to definition", handlers.onGoto);
  gotoBtn.classList.add("footnote-popup-btn-goto");
  const saveBtn = buildIconButton(icons.save, "Save (Enter)", handlers.onSave);
  saveBtn.classList.add("footnote-popup-btn-save");

  btnRow.appendChild(gotoBtn);
  btnRow.appendChild(saveBtn);
  container.appendChild(btnRow);

  return { container, textarea };
}

function buildIconButton(svg: string, title: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "footnote-popup-btn";
  btn.type = "button";
  btn.title = title;
  btn.innerHTML = svg;
  btn.addEventListener("click", onClick);
  return btn;
}

