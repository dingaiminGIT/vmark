/**
 * HTML Sanitization Utilities
 *
 * Provides secure HTML sanitization using DOMPurify to prevent XSS attacks.
 */

import DOMPurify from "dompurify";

/**
 * Sanitize HTML content, removing potentially dangerous elements.
 * Safe for general HTML content.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "div",
      "span",
      "p",
      "br",
      "strong",
      "em",
      "b",
      "i",
      "u",
      "s",
      "code",
      "pre",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "hr",
      "sub",
      "sup",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "id", "target"],
    ALLOW_DATA_ATTR: false,
  });
}

const HTML_PREVIEW_TAGS_INLINE = [
  "span",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "code",
  "a",
  "img",
  "sub",
  "sup",
];

const HTML_PREVIEW_TAGS_BLOCK = [
  "div",
  "span",
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "hr",
  "sub",
  "sup",
];

const HTML_PREVIEW_ATTRS = [
  "href",
  "src",
  "alt",
  "title",
  "class",
  "id",
  "target",
  "rel",
];

const HTML_PREVIEW_STYLE_PROPS = new Set([
  "color",
  "background-color",
  "font-weight",
  "font-style",
  "text-decoration",
]);

export type HtmlPreviewContext = "inline" | "block";

export interface HtmlPreviewOptions {
  allowStyles?: boolean;
  context?: HtmlPreviewContext;
}

export function sanitizeHtmlPreview(html: string, options?: HtmlPreviewOptions): string {
  const context = options?.context ?? "inline";
  const allowStyles = options?.allowStyles ?? false;
  const allowedTags = context === "block" ? HTML_PREVIEW_TAGS_BLOCK : HTML_PREVIEW_TAGS_INLINE;
  const allowedAttrs = allowStyles ? [...HTML_PREVIEW_ATTRS, "style"] : HTML_PREVIEW_ATTRS;

  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttrs,
    ALLOW_DATA_ATTR: false,
  });

  if (!allowStyles) {
    return sanitized;
  }

  return filterAllowedStyles(sanitized);
}

function filterAllowedStyles(html: string): string {
  if (typeof document === "undefined") {
    return html;
  }

  const container = document.createElement("div");
  container.innerHTML = html;

  const elements = container.querySelectorAll<HTMLElement>("[style]");
  elements.forEach((element) => {
    const style = element.getAttribute("style") ?? "";
    const sanitizedStyle = sanitizeStyleAttribute(style);
    if (!sanitizedStyle) {
      element.removeAttribute("style");
      return;
    }
    element.setAttribute("style", sanitizedStyle);
  });

  return container.innerHTML;
}

function sanitizeStyleAttribute(style: string): string {
  const declarations = style.split(";").map((decl) => decl.trim()).filter(Boolean);
  const safeDeclarations: string[] = [];

  for (const declaration of declarations) {
    const [rawProperty, ...rest] = declaration.split(":");
    if (!rawProperty || rest.length === 0) continue;

    const property = rawProperty.trim().toLowerCase();
    if (!HTML_PREVIEW_STYLE_PROPS.has(property)) continue;

    const value = rest.join(":").trim();
    if (!isSafeStyleValue(value)) continue;

    safeDeclarations.push(`${property}: ${value}`);
  }

  return safeDeclarations.join("; ");
}

function isSafeStyleValue(value: string): boolean {
  const lowered = value.toLowerCase();
  if (lowered.includes("url(") || lowered.includes("expression(") || lowered.includes("javascript:")) {
    return false;
  }
  if (lowered.includes("<") || lowered.includes(">")) {
    return false;
  }
  return true;
}

/**
 * Sanitize SVG content for safe rendering (e.g., Mermaid diagrams).
 * Allows SVG elements but removes scripts and event handlers.
 */
export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ["foreignObject"],
    FORBID_TAGS: ["script"],
    FORBID_ATTR: [
      "onerror",
      "onload",
      "onclick",
      "onmouseover",
      "onfocus",
      "onblur",
    ],
  });
}

/**
 * Sanitize KaTeX output for safe rendering.
 */
export function sanitizeKatex(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "span",
      "math",
      "semantics",
      "mrow",
      "mi",
      "mo",
      "mn",
      "msup",
      "msub",
      "mfrac",
      "mover",
      "munder",
      "munderover",
      "msqrt",
      "mroot",
      "mtable",
      "mtr",
      "mtd",
      "mtext",
      "mspace",
      "annotation",
      "svg",
      "line",
      "path",
    ],
    ALLOWED_ATTR: [
      "class",
      "style",
      "mathvariant",
      "displaystyle",
      "scriptlevel",
      "width",
      "height",
      "viewBox",
      "preserveAspectRatio",
      "xmlns",
      "d",
      "x1",
      "y1",
      "x2",
      "y2",
      "stroke",
      "stroke-width",
    ],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Escape HTML entities for safe text display.
 * Use when displaying raw content in error messages.
 */
export function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}
