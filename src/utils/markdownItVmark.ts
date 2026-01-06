import MarkdownIt from "markdown-it";

type InlineStateLike = {
  pos: number;
  posMax: number;
  src: string;
  md: { inline: { tokenize: (state: unknown) => void } };
  push: (type: string, tag: string, nesting: number) => {
    markup?: string;
    attrs?: Array<[string, string]>;
    content?: string;
  };
};

function addFootnoteReference(md: MarkdownIt) {
  md.inline.ruler.push("footnote_reference", (state: unknown, silent: boolean) => {
    const inlineState = state as InlineStateLike;
    const start = inlineState.pos;
    const max = inlineState.posMax;

    if (start + 4 > max) return false;
    if (inlineState.src[start] !== "[" || inlineState.src[start + 1] !== "^") return false;

    const end = inlineState.src.indexOf("]", start + 2);
    if (end === -1 || end >= max) return false;

    const label = inlineState.src.slice(start + 2, end).trim();
    if (!label) return false;

    if (silent) return true;

    const token = inlineState.push("footnote_reference", "sup", 0);
    token.attrs = [["label", label]];
    token.content = label;

    inlineState.pos = end + 1;
    return true;
  });
}

function addInlineMath(md: MarkdownIt) {
  md.inline.ruler.push("math_inline", (state: unknown, silent: boolean) => {
    const inlineState = state as InlineStateLike;
    const start = inlineState.pos;
    const max = inlineState.posMax;

    if (inlineState.src[start] !== "$") return false;
    if (start + 1 < max && inlineState.src[start + 1] === "$") return false;

    let searchPos = start + 1;
    while (searchPos < max) {
      const end = inlineState.src.indexOf("$", searchPos);
      if (end === -1 || end >= max) return false;
      if (end > start + 1 && inlineState.src[end - 1] === "\\") {
        searchPos = end + 1;
        continue;
      }

      const content = inlineState.src.slice(start + 1, end);
      if (!content.trim()) return false;
      if (/^\s/.test(content) || /\s$/.test(content)) return false;
      if (silent) return true;

      const token = inlineState.push("math_inline", "span", 0);
      token.markup = "$";
      token.content = content;
      inlineState.pos = end + 1;
      return true;
    }

    return false;
  });
}

function addDelimitedMark(
  md: MarkdownIt,
  opts: {
    name: string;
    marker: string;
    tag: string;
    skipDoubleMarker?: boolean;
  }
) {
  const marker = opts.marker;
  const markerLen = marker.length;
  const skipDouble = opts.skipDoubleMarker ?? false;

  md.inline.ruler.push(opts.name, (state: unknown, silent: boolean) => {
    const inlineState = state as InlineStateLike;
    const start = inlineState.pos;
    const max = inlineState.posMax;

    if (start + markerLen > max) return false;
    if (inlineState.src.slice(start, start + markerLen) !== marker) return false;

    if (skipDouble && markerLen === 1 && start + 1 < max && inlineState.src[start + 1] === marker) {
      return false;
    }

    let searchPos = start + markerLen;
    while (searchPos < max) {
      const end = inlineState.src.indexOf(marker, searchPos);
      if (end === -1 || end >= max) return false;

      if (skipDouble && markerLen === 1 && end + 1 < max && inlineState.src[end + 1] === marker) {
        searchPos = end + 2;
        continue;
      }

      if (end <= start + markerLen) return false;
      if (silent) return true;

      const tokenOpen = inlineState.push(`${opts.name}_open`, opts.tag, 1);
      tokenOpen.markup = marker;

      const oldMax = inlineState.posMax;
      inlineState.pos = start + markerLen;
      inlineState.posMax = end;
      inlineState.md.inline.tokenize(inlineState as unknown as Parameters<typeof inlineState.md.inline.tokenize>[0]);
      inlineState.posMax = oldMax;

      inlineState.pos = end + markerLen;

      const tokenClose = inlineState.push(`${opts.name}_close`, opts.tag, -1);
      tokenClose.markup = marker;
      return true;
    }

    return false;
  });
}

export function createVmarkMarkdownIt(): MarkdownIt {
  // html:true is required to parse <details>/<summary> blocks. We ignore all HTML tokens
  // except the specific <details> wrapper, which we convert into a structured node.
  const md = new MarkdownIt("commonmark", { html: true }).enable(["strikethrough", "table"]);

  addFootnoteReference(md);
  addInlineMath(md);
  addDelimitedMark(md, { name: "highlight", marker: "==", tag: "mark" });
  addDelimitedMark(md, { name: "subscript", marker: "~", tag: "sub", skipDoubleMarker: true });
  addDelimitedMark(md, { name: "superscript", marker: "^", tag: "sup" });

  return md;
}
