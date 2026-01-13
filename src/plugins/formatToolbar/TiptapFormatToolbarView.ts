import type { EditorView } from "@tiptap/pm/view";
import { emit } from "@tauri-apps/api/event";
import type { AnchorRect } from "@/utils/popupPosition";
import { useFormatToolbarStore } from "@/stores/formatToolbarStore";
import { useLinkPopupStore } from "@/stores/linkPopupStore";
import type { ToolbarMode, ContextMode, NodeContext } from "@/stores/formatToolbarStore";
import { addRecentLanguage } from "@/plugins/sourceFormatPopup/languages";
import { expandedToggleMarkTiptap } from "@/plugins/editorPlugins.tiptap";
import { handleBlockquoteNest, handleBlockquoteUnnest, handleListIndent, handleListOutdent, handleRemoveBlockquote, handleRemoveList, handleToBulletList, handleToOrderedList } from "./nodeActions.tiptap";
import { TIPTAP_HEADING_BUTTONS } from "./tiptapUi";
import { createToolbarButton, createToolbarRow } from "./tiptapToolbarDom";
import { getFocusableElements, installToolbarNavigation } from "./tiptapToolbarNavigation";
import { positionTiptapToolbar } from "./tiptapToolbarPosition";
import { appendTiptapTableRows } from "./tiptapTableRows";
import { resolveLinkPopupPayload } from "./linkPopupUtils";
import {
  buildBlockquoteRow,
  buildCodeRow,
  buildFormatRow,
  buildInsertRow,
  buildListRow,
  type InsertAction,
  type ListAction,
  type QuoteAction,
} from "./tiptapToolbarRows";

export class TiptapFormatToolbarView {
  private container: HTMLElement;
  private unsubscribe: () => void;
  private editorView: EditorView;
  private wasOpen = false;
  private currentMode: ToolbarMode = "format";
  private currentContextMode: ContextMode = "format";
  private currentNodeContext: NodeContext = null;
  private removeNavigation: (() => void) | null = null;

  constructor(view: EditorView) {
    this.editorView = view;
    this.container = document.createElement("div");
    this.container.className = "format-toolbar";
    this.container.style.display = "none";
    document.body.appendChild(this.container);

    this.unsubscribe = useFormatToolbarStore.subscribe((state) => {
      if (state.isOpen && state.anchorRect) {
        if (state.editorView) {
          this.editorView = state.editorView as unknown as EditorView;
        }

        const isFirstOpen = !this.wasOpen;
        const modeChanged = state.mode !== this.currentMode;
        const contextModeChanged = state.mode === "format" && state.contextMode !== this.currentContextMode;
        const nodeContextChanged = state.mode === "merged" && state.nodeContext?.type !== this.currentNodeContext?.type;

        // Render on first open OR when mode/context changes
        if (isFirstOpen || modeChanged || contextModeChanged || nodeContextChanged) {
          this.render(state.mode, state.contextMode, state.headingInfo?.level ?? 0, state.nodeContext);
          this.currentMode = state.mode;
          this.currentContextMode = state.contextMode;
          this.currentNodeContext = state.nodeContext;
        } else if (state.mode === "heading" && state.headingInfo) {
          this.updateHeadingActiveState(state.headingInfo.level);
        }

        if (isFirstOpen) {
          this.show(state.anchorRect);
        } else {
          positionTiptapToolbar({ container: this.container, editorView: this.editorView, anchorRect: state.anchorRect });
        }
        this.wasOpen = true;
      } else {
        this.hide();
        this.wasOpen = false;
      }
    });
  }

  private render(mode: ToolbarMode, contextMode: ContextMode, activeHeadingLevel: number, nodeContext: NodeContext) {
    this.container.innerHTML = "";

    if (mode === "heading") {
      const row = createToolbarRow();
      for (const btn of TIPTAP_HEADING_BUTTONS) {
        row.appendChild(
          createToolbarButton({
            icon: btn.icon,
            title: btn.title,
            active: btn.level === activeHeadingLevel,
            onClick: () => this.handleHeadingChange(btn.level),
          })
        );
      }
      this.container.appendChild(row);
      return;
    }

    if (mode === "code") {
      const store = useFormatToolbarStore.getState();
      const currentLang = store.codeBlockInfo?.language || "";
      this.container.appendChild(buildCodeRow(currentLang, (lang) => this.handleLanguageChange(lang)));
      return;
    }

    // mode === "format" or "merged"
    if (mode === "format") {
      if (contextMode === "format") {
        this.container.appendChild(buildFormatRow(this.editorView, (mark) => this.handleFormat(mark)));
      } else {
        this.container.appendChild(buildInsertRow(contextMode, (action) => this.handleInsertAction(action)));
      }
    } else if (mode === "merged") {
      this.container.appendChild(buildFormatRow(this.editorView, (mark) => this.handleFormat(mark)));
    }

    if (mode === "merged" && nodeContext) {
      if (nodeContext.type === "table") {
        appendTiptapTableRows(this.container, this.editorView);
      } else if (nodeContext.type === "list") {
        this.container.appendChild(buildListRow((action) => this.handleListAction(action)));
      } else if (nodeContext.type === "blockquote") {
        this.container.appendChild(buildBlockquoteRow((action) => this.handleQuoteAction(action)));
      }
    }
  }

  private updateHeadingActiveState(level: number) {
    const buttons = Array.from(this.container.querySelectorAll<HTMLButtonElement>(".format-toolbar-btn"));
    for (const btn of buttons) {
      btn.classList.remove("active");
    }
    const index = TIPTAP_HEADING_BUTTONS.findIndex((b) => b.level === level);
    if (index >= 0 && buttons[index]) {
      buttons[index].classList.add("active");
    }
  }

  private handleFormat(markType: string) {
    this.editorView.focus();
    const store = useFormatToolbarStore.getState();
    if (markType === "link") {
      const selection = this.editorView.state.selection;
      const payload = resolveLinkPopupPayload(
        { from: selection.from, to: selection.to },
        store.linkContext
      );
      if (payload) {
        const startCoords = this.editorView.coordsAtPos(payload.linkFrom);
        const endCoords = this.editorView.coordsAtPos(payload.linkTo);
        useLinkPopupStore.getState().openPopup({
          href: payload.href,
          linkFrom: payload.linkFrom,
          linkTo: payload.linkTo,
          anchorRect: {
            top: startCoords.top,
            left: startCoords.left,
            bottom: startCoords.bottom,
            right: endCoords.right,
          },
        });
        store.clearOriginalCursor();
        store.closeToolbar();
        return;
      }
    }

    expandedToggleMarkTiptap(this.editorView, markType);
    store.clearOriginalCursor();
    store.closeToolbar();
  }

  private handleHeadingChange(level: number) {
    const store = useFormatToolbarStore.getState();
    const headingInfo = store.headingInfo;
    if (!headingInfo) return;

    const { state, dispatch } = this.editorView;
    const { nodePos } = headingInfo;

    if (level === 0) {
      const paragraphType = state.schema.nodes.paragraph;
      if (paragraphType) {
        dispatch(state.tr.setNodeMarkup(nodePos, paragraphType));
      }
    } else {
      const headingType = state.schema.nodes.heading;
      if (headingType) {
        dispatch(state.tr.setNodeMarkup(nodePos, headingType, { level }));
      }
    }

    this.editorView.focus();
    store.clearOriginalCursor();
    store.closeToolbar();
  }

  private handleLanguageChange(language: string) {
    const store = useFormatToolbarStore.getState();
    const info = store.codeBlockInfo;
    if (!info) return;

    const { state, dispatch } = this.editorView;
    const node = state.doc.nodeAt(info.nodePos);
    if (node) {
      dispatch(state.tr.setNodeMarkup(info.nodePos, undefined, { ...node.attrs, language }));
    }

    addRecentLanguage(language);
    this.editorView.focus();
    store.clearOriginalCursor();
    store.closeToolbar();
  }

  private handleListAction(action: ListAction) {
    if (action === "indent") handleListIndent(this.editorView);
    if (action === "outdent") handleListOutdent(this.editorView);
    if (action === "bullet") handleToBulletList(this.editorView);
    if (action === "ordered") handleToOrderedList(this.editorView);
    if (action === "remove") handleRemoveList(this.editorView);
    const store = useFormatToolbarStore.getState();
    store.clearOriginalCursor();
    store.closeToolbar();
  }

  private handleInsertAction(action: InsertAction) {
    if (action === "image") void emit("menu:image");
    if (action === "table") void emit("menu:insert-table");
    if (action === "unordered-list") void emit("menu:unordered-list");
    if (action === "ordered-list") void emit("menu:ordered-list");
    if (action === "blockquote") void emit("menu:quote");
    if (action === "divider") void emit("menu:horizontal-line");
    const store = useFormatToolbarStore.getState();
    store.clearOriginalCursor();
    store.closeToolbar();
  }

  private handleQuoteAction(action: QuoteAction) {
    if (action === "nest") handleBlockquoteNest(this.editorView);
    if (action === "unnest") handleBlockquoteUnnest(this.editorView);
    if (action === "remove") handleRemoveBlockquote(this.editorView);
    const store = useFormatToolbarStore.getState();
    store.clearOriginalCursor();
    store.closeToolbar();
  }

  private show(anchorRect: AnchorRect) {
    this.container.style.display = "flex";
    positionTiptapToolbar({ container: this.container, editorView: this.editorView, anchorRect });
    this.removeNavigation?.();
    this.removeNavigation = installToolbarNavigation({
      container: this.container,
      isOpen: () => useFormatToolbarStore.getState().isOpen,
      onClose: () => useFormatToolbarStore.getState().closeToolbar(),
    });
    this.focusInitialControl();
  }

  private hide() {
    this.container.style.display = "none";
    this.removeNavigation?.();
    this.removeNavigation = null;
  }

  private focusInitialControl() {
    setTimeout(() => {
      const focusable = getFocusableElements(this.container);
      if (focusable.length === 0) return;
      const store = useFormatToolbarStore.getState();
      if (store.mode === "heading") {
        const active = this.container.querySelector<HTMLElement>(".format-toolbar-btn.active");
        if (active) {
          active.focus();
          return;
        }
      }
      focusable[0].focus();
    }, 30);
  }

  destroy() {
    this.unsubscribe();
    this.removeNavigation?.();
    this.removeNavigation = null;
    this.container.remove();
  }
}
