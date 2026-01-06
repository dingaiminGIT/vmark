type StackEntry = { type: unknown; attrs: unknown; content: unknown[]; marks: unknown };

type MarkdownParseStateLike = {
  schema: {
    nodes: Record<string, unknown>;
    text: (text: string) => unknown;
  };
  openNode: (type: unknown, attrs: unknown) => void;
  closeNode: () => void;
  addNode: (type: unknown, attrs?: unknown, content?: unknown) => unknown;
  stack?: StackEntry[];
};

export type TokenHandler = (state: unknown, token: unknown, tokens: unknown[], index: number) => void;

function supportsAlignmentAttr(nodeType: unknown): boolean {
  const attrs = (nodeType as { spec?: { attrs?: Record<string, unknown> } }).spec?.attrs;
  return Boolean(attrs && "alignment" in attrs);
}

function getTableCellAlignment(token: { attrs: Array<[string, string]> | null }): "left" | "center" | "right" | null {
  const style = token.attrs?.find(([name]) => name === "style")?.[1] ?? "";
  const match = style.match(/text-align\s*:\s*(left|center|right)/i);
  if (!match) return null;
  const alignment = match[1]?.toLowerCase();
  if (alignment === "left" || alignment === "center" || alignment === "right") return alignment;
  return null;
}

export function patchTokenHandlers(handlers: Record<string, TokenHandler>) {
  const parseState = (state: unknown) => state as MarkdownParseStateLike & Record<string, unknown>;

  // === Alert blocks: > [!NOTE]
  const originalBlockquoteOpen = handlers.blockquote_open;
  const originalBlockquoteClose = handlers.blockquote_close;
  const originalParagraphOpen = handlers.paragraph_open;
  const originalParagraphClose = handlers.paragraph_close;
  const originalInline = handlers.inline;

  const ALERT_TYPES = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;

  type AlertParseMode = "skipParagraph" | "stripInline";
  type AlertInfo = { alertType: string; mode: AlertParseMode };

  const getAlertInfo = (tokens: unknown[], index: number): AlertInfo | null => {
    const t = tokens as Array<{ type?: string; content?: string }>;
    if (t[index + 1]?.type !== "paragraph_open") return null;
    if (t[index + 2]?.type !== "inline") return null;
    if (t[index + 3]?.type !== "paragraph_close") return null;

    const content = String(t[index + 2]?.content ?? "");
    const trimmed = content.trim();

    const markerOnly = trimmed.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i);
    if (markerOnly) {
      const upper = markerOnly[1]?.toUpperCase() ?? "";
      if (!ALERT_TYPES.includes(upper as (typeof ALERT_TYPES)[number])) return null;
      return { alertType: upper, mode: "skipParagraph" };
    }

    const markerWithBody = content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s*\r?\n|\s+)[\s\S]*$/i);
    if (markerWithBody) {
      const upper = markerWithBody[1]?.toUpperCase() ?? "";
      if (!ALERT_TYPES.includes(upper as (typeof ALERT_TYPES)[number])) return null;
      return { alertType: upper, mode: "stripInline" };
    }

    return null;
  };

  const stripAlertMarkerFromInlineToken = (token: unknown, alertType: string): void => {
    const inlineToken = token as { children?: Array<{ type?: string; content?: string }> };
    const children = inlineToken.children;
    if (!children || children.length === 0) return;

    const markerRe = new RegExp(`^\\[!${alertType}\\]`, "i");
    if (children[0]?.type === "text") {
      const textToken = children[0];
      textToken.content = String(textToken.content ?? "").replace(markerRe, "");
      textToken.content = textToken.content.replace(/^[ \t]+/, "");
      if (textToken.content.length === 0) children.shift();
    }

    if (children[0]?.type === "softbreak") {
      children.shift();
    }

    if (children[0]?.type === "text") {
      const textToken = children[0];
      textToken.content = String(textToken.content ?? "").replace(/^[ \t]+/, "");
      if (textToken.content.length === 0) children.shift();
    }
  };

  handlers.blockquote_open = (state: unknown, token: unknown, tokens: unknown[], index: number) => {
    const ps = parseState(state);
    const alertInfo = getAlertInfo(tokens, index);
    const alertNodeType = ps.schema.nodes.alertBlock;

    if (alertInfo && alertNodeType) {
      ps.openNode(alertNodeType, { alertType: alertInfo.alertType });

      if (alertInfo.mode === "skipParagraph") {
        ps.__vmarkSkipNextParagraph = true;
      } else {
        stripAlertMarkerFromInlineToken((tokens as unknown[])[index + 2], alertInfo.alertType);
      }
      return;
    }

    return originalBlockquoteOpen(state, token, tokens, index);
  };

  const ensureAlertHasContent = (ps: MarkdownParseStateLike & Record<string, unknown>) => {
    const stack = (ps.stack ?? []) as StackEntry[];
    const top = stack[stack.length - 1];
    if (!top || (top.type as { name?: string }).name !== "alertBlock") return;
    if (top.content.length > 0) return;
    const paragraphType = ps.schema.nodes.paragraph;
    if (!paragraphType) return;
    ps.addNode(paragraphType, null, null);
  };

  handlers.blockquote_close = (state: unknown, token: unknown, tokens: unknown[], index: number) => {
    const ps = parseState(state);
    ensureAlertHasContent(ps);
    return originalBlockquoteClose(state, token, tokens, index);
  };

  handlers.paragraph_open = (state: unknown, token: unknown, tokens: unknown[], index: number) => {
    const ps = parseState(state);
    if (ps.__vmarkSkipNextParagraph) {
      ps.__vmarkSkipNextParagraph = false;
      ps.__vmarkIgnoringParagraph = true;
      return;
    }
    return originalParagraphOpen(state, token, tokens, index);
  };

  handlers.inline = (state: unknown, token: unknown, tokens: unknown[], index: number) => {
    const ps = parseState(state);
    if (ps.__vmarkIgnoringParagraph) return;
    return originalInline(state, token, tokens, index);
  };

  handlers.paragraph_close = (state: unknown, token: unknown, tokens: unknown[], index: number) => {
    const ps = parseState(state);
    if (ps.__vmarkIgnoringParagraph) {
      ps.__vmarkIgnoringParagraph = false;
      return;
    }
    return originalParagraphClose(state, token, tokens, index);
  };

  // === Task list items: - [ ] / - [x]
  const originalListItemOpen = handlers.list_item_open;
  const stripTaskMarkerAndGetChecked = (tokens: unknown[], index: number): boolean | null => {
    const t = tokens as Array<{ type?: string; children?: Array<{ type?: string; content?: string }> }>;
    if (t[index + 1]?.type !== "paragraph_open") return null;
    if (t[index + 2]?.type !== "inline") return null;
    const inlineChildren = t[index + 2]?.children ?? [];
    const first = inlineChildren[0];
    if (first?.type !== "text") return null;

    const match = String(first.content ?? "").match(/^\[( |x|X)\]\s+/);
    if (!match) return null;

    first.content = String(first.content ?? "").replace(/^\[( |x|X)\]\s+/, "");
    if (String(first.content ?? "").length === 0) inlineChildren.shift();

    return String(match[1] ?? "").toLowerCase() === "x";
  };

  handlers.list_item_open = (state: unknown, token: unknown, tokens: unknown[], index: number) => {
    const ps = parseState(state);
    const checked = stripTaskMarkerAndGetChecked(tokens, index);
    const listItemType = ps.schema.nodes.listItem;
    if (checked !== null && listItemType) {
      ps.openNode(listItemType, { checked });
      return;
    }
    return originalListItemOpen(state, token, tokens, index);
  };

  // === Details blocks: <details><summary>...</summary> ... </details>
  const originalHtmlBlock = handlers.html_block;

  const ensureDetailsHasContent = (ps: MarkdownParseStateLike & Record<string, unknown>) => {
    const stack = (ps.stack ?? []) as StackEntry[];
    const top = stack[stack.length - 1];
    if (!top || (top.type as { name?: string }).name !== "detailsBlock") return;
    if (top.content.length > 1) return;
    const paragraphType = ps.schema.nodes.paragraph;
    if (!paragraphType) return;
    ps.addNode(paragraphType, null, null);
  };

  handlers.html_block = (state: unknown, token: unknown, tokens: unknown[], index: number) => {
    const ps = parseState(state);
    const content = String((token as { content?: string }).content ?? "").trim();

    if (content.toLowerCase().startsWith("<details")) {
      const detailsType = ps.schema.nodes.detailsBlock;
      const summaryType = ps.schema.nodes.detailsSummary;

      if (!detailsType || !summaryType) return originalHtmlBlock(state, token, tokens, index);

      const tagMatch = content.match(/<details([^>]*)>/i);
      const attrs = tagMatch?.[1] ?? "";
      const open = /\bopen\b/i.test(attrs);

      const summaryMatch = content.match(/<summary>([\s\S]*?)<\/summary>/i);
      const summaryText = (summaryMatch?.[1] ?? "Details").trim() || "Details";

      ps.openNode(detailsType, { open });
      ps.addNode(summaryType, null, [ps.schema.text(summaryText)]);
      ps.__vmarkDetailsDepth = (Number(ps.__vmarkDetailsDepth ?? 0) || 0) + 1;
      return;
    }

    if (content.toLowerCase() === "</details>") {
      const depth = Number(ps.__vmarkDetailsDepth ?? 0) || 0;
      if (depth > 0) {
        ensureDetailsHasContent(ps);
        ps.closeNode();
        ps.__vmarkDetailsDepth = depth - 1;
      }
      return;
    }

    return originalHtmlBlock(state, token, tokens, index);
  };

  // === Tables: wrap table cell content in a paragraph
  const openTableCell = (cellType: "tableHeader" | "tableCell") => (state: unknown, token: unknown) => {
    const ps = parseState(state);
    const tokenWithAttrs = token as { attrs: Array<[string, string]> | null };

    const nodeType = ps.schema.nodes[cellType];
    const paragraphType = ps.schema.nodes.paragraph;
    if (!nodeType || !paragraphType) return;

    const alignment = getTableCellAlignment(tokenWithAttrs);
    const attrs = alignment && supportsAlignmentAttr(nodeType) ? { alignment } : null;

    ps.openNode(nodeType, attrs);
    ps.openNode(paragraphType, null);
  };

  const closeTableCell = (state: unknown) => {
    const ps = parseState(state);
    ps.closeNode(); // paragraph
    ps.closeNode(); // cell
  };

  handlers.th_open = openTableCell("tableHeader");
  handlers.th_close = closeTableCell;
  handlers.td_open = openTableCell("tableCell");
  handlers.td_close = closeTableCell;
}

