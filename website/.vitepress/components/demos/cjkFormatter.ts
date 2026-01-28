/**
 * CJK Text Formatting Rules (Standalone for VitePress demo)
 * Simplified version of VMark's CJK formatter
 */

export type QuoteStyle = "curly" | "corner" | "guillemets";

export interface CJKFormattingSettings {
  // Group 1: Universal
  ellipsisNormalization: boolean;
  newlineCollapsing: boolean;
  // Group 2: Fullwidth Normalization
  fullwidthAlphanumeric: boolean;
  fullwidthPunctuation: boolean;
  fullwidthParentheses: boolean;
  fullwidthBrackets: boolean;
  // Group 3: Spacing
  cjkEnglishSpacing: boolean;
  cjkParenthesisSpacing: boolean;
  currencySpacing: boolean;
  slashSpacing: boolean;
  spaceCollapsing: boolean;
  // Group 4: Dash & Quote
  dashConversion: boolean;
  emdashSpacing: boolean;
  smartQuoteConversion: boolean;
  quoteStyle: QuoteStyle;
  quoteSpacing: boolean;
  singleQuoteSpacing: boolean;
  cjkCornerQuotes: boolean;
  cjkNestedQuotes: boolean;
  // Group 5: Cleanup
  consecutivePunctuationLimit: number;
  trailingSpaceRemoval: boolean;
}

export const defaultCJKSettings: CJKFormattingSettings = {
  ellipsisNormalization: true,
  newlineCollapsing: true,
  fullwidthAlphanumeric: true,
  fullwidthPunctuation: true,
  fullwidthParentheses: true,
  fullwidthBrackets: true,
  cjkEnglishSpacing: true,
  cjkParenthesisSpacing: true,
  currencySpacing: true,
  slashSpacing: true,
  spaceCollapsing: true,
  dashConversion: true,
  emdashSpacing: true,
  smartQuoteConversion: true,
  quoteStyle: "curly",
  quoteSpacing: true,
  singleQuoteSpacing: true,
  cjkCornerQuotes: true,
  cjkNestedQuotes: true,
  consecutivePunctuationLimit: 1,
  trailingSpaceRemoval: true,
};

// Character ranges
const HAN = "\u4e00-\u9fff\u3400-\u4dbf";
const HIRAGANA = "\u3040-\u309f";
const KATAKANA = "\u30a0-\u30ff\u31f0-\u31ff";
const HANGUL = "\uac00-\ud7af\u1100-\u11ff\u3130-\u318f";
const BOPOMOFO = "\u3100-\u312f\u31a0-\u31bf";
const CJK_ALL = `${HAN}${BOPOMOFO}${HIRAGANA}${KATAKANA}${HANGUL}`;
const CJK_NO_KOREAN = `${HAN}${BOPOMOFO}${HIRAGANA}${KATAKANA}`;

const CJK_TERMINAL_PUNCTUATION = "，。！？；：、";
const CJK_CLOSING_BRACKETS = "》」』】）〉";
const CJK_OPENING_BRACKETS = "《「『【（〈";
const CJK_CHARS_PATTERN = `[${HAN}${HIRAGANA}${KATAKANA}《》「」『』【】（）〈〉，。！？；：、]`;

// Pre-compiled regexes for fullwidth punctuation
const FULLWIDTH_PUNCT_REPLACEMENTS = [
  { half: ",", full: "，" },
  { half: ".", full: "。" },
  { half: "!", full: "！" },
  { half: "?", full: "？" },
  { half: ";", full: "；" },
  { half: ":", full: "：" },
].map(({ half, full }) => {
  const escaped = half.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return {
    between: new RegExp(`([${CJK_NO_KOREAN}])${escaped}([${CJK_NO_KOREAN}])`, "g"),
    trailing: new RegExp(`([${CJK_NO_KOREAN}])${escaped}(?=\\s|$)`, "g"),
    full,
  };
});

export function containsCJK(text: string): boolean {
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(text)) return true;
  if (/[\u3040-\u309f\u30a0-\u30ff\u31f0-\u31ff]/.test(text)) return true;
  if (/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(text)) return true;
  if (/[\u3100-\u312f\u31a0-\u31bf]/.test(text)) return true;
  return false;
}

// Group 1: Universal
export function normalizeEllipsis(text: string): string {
  text = text.replace(/\s*\.\s+\.\s+\.(?:\s+\.)*/g, "...");
  text = text.replace(/\.\.\.\s*(?=\S)/g, "... ");
  return text;
}

export function collapseNewlines(text: string): string {
  text = text.replace(/(\n\n)(<br\s*\/?>\n\n)+/g, "\n\n");
  text = text.replace(/\n\n<br\s*\/?>\n\n/g, "\n\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text;
}

// Group 2: Fullwidth Normalization
export function normalizeFullwidthAlphanumeric(text: string): string {
  let result = "";
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0xff10 && code <= 0xff19) {
      result += String.fromCharCode(code - 0xfee0);
    } else if (code >= 0xff21 && code <= 0xff3a) {
      result += String.fromCharCode(code - 0xfee0);
    } else if (code >= 0xff41 && code <= 0xff5a) {
      result += String.fromCharCode(code - 0xfee0);
    } else {
      result += char;
    }
  }
  return result;
}

export function normalizeFullwidthPunctuation(text: string): string {
  for (const { between, trailing, full } of FULLWIDTH_PUNCT_REPLACEMENTS) {
    text = text.replace(between, `$1${full}$2`);
    text = text.replace(trailing, `$1${full}`);
  }
  return text;
}

export function normalizeFullwidthParentheses(text: string): string {
  return text.replace(new RegExp(`\\(([${CJK_NO_KOREAN}][^()]*)\\)`, "g"), "（$1）");
}

export function normalizeFullwidthBrackets(text: string): string {
  return text.replace(new RegExp(`\\[([${CJK_NO_KOREAN}][^\\[\\]]*)\\]`, "g"), "【$1】");
}

// Group 3: Spacing
export function addCJKEnglishSpacing(text: string): string {
  const alphanumPattern = "(?:[$¥€£₹][ ]?)?[A-Za-z0-9]+(?:[%‰℃℉]|°[CcFf]?|[ ]?(?:USD|CNY|EUR|GBP|RMB))?";
  text = text.replace(new RegExp(`([${CJK_ALL}])(${alphanumPattern})`, "g"), "$1 $2");
  text = text.replace(new RegExp(`(${alphanumPattern})([${CJK_ALL}])`, "g"), "$1 $2");
  return text;
}

export function addCJKParenthesisSpacing(text: string): string {
  text = text.replace(new RegExp(`([${CJK_ALL}])\\(`, "g"), "$1 (");
  text = text.replace(new RegExp(`\\)([${CJK_ALL}])`, "g"), ") $1");
  return text;
}

export function fixCurrencySpacing(text: string): string {
  return text.replace(/([$¥€£₹]|USD|CNY|EUR|GBP)\s+(\d)/g, "$1$2");
}

export function fixSlashSpacing(text: string): string {
  return text.replace(/(?<![/:])\s*\/\s*(?!\/)/g, "/");
}

export function collapseSpaces(text: string): string {
  return text.replace(/(\S) {2,}/g, "$1 ");
}

// Group 4: Dash & Quote
export function convertDashes(text: string): string {
  const cjkBothPattern = new RegExp(`(${CJK_CHARS_PATTERN})\\s*-{2,}\\s*(${CJK_CHARS_PATTERN})`, "g");
  const cjkLeftPattern = new RegExp(`(${CJK_CHARS_PATTERN})\\s*-{2,}\\s*([A-Za-z0-9])`, "g");
  const cjkRightPattern = new RegExp(`([A-Za-z0-9])\\s*-{2,}\\s*(${CJK_CHARS_PATTERN})`, "g");

  const replacer = (_: string, before: string, after: string) => {
    const leftSpace = CJK_CLOSING_BRACKETS.includes(before) ? "" : " ";
    const rightSpace = CJK_OPENING_BRACKETS.includes(after) ? "" : " ";
    return `${before}${leftSpace}——${rightSpace}${after}`;
  };

  text = text.replace(cjkBothPattern, replacer);
  text = text.replace(cjkLeftPattern, replacer);
  text = text.replace(cjkRightPattern, replacer);
  return text;
}

export function fixEmdashSpacing(text: string): string {
  return text.replace(/([^\s])\s*——\s*([^\s])/g, (_, before, after) => {
    const leftSpace = CJK_CLOSING_BRACKETS.includes(before) ? "" : " ";
    const rightSpace = CJK_OPENING_BRACKETS.includes(after) ? "" : " ";
    return `${before}${leftSpace}——${rightSpace}${after}`;
  });
}

const QUOTE_STYLES: Record<QuoteStyle, { doubleOpen: string; doubleClose: string; singleOpen: string; singleClose: string }> = {
  curly: { doubleOpen: "\u201c", doubleClose: "\u201d", singleOpen: "\u2018", singleClose: "\u2019" },
  corner: { doubleOpen: "「", doubleClose: "」", singleOpen: "『", singleClose: "』" },
  guillemets: { doubleOpen: "«", doubleClose: "»", singleOpen: "‹", singleClose: "›" },
};

export function convertStraightToSmartQuotes(text: string, style: QuoteStyle): string {
  const quotes = QUOTE_STYLES[style];
  text = text.replace(/"/g, (_, offset) => {
    const before = offset > 0 ? text[offset - 1] : "";
    if (offset === 0 || /[\s([{「『《【〈]/.test(before)) {
      return quotes.doubleOpen;
    }
    return quotes.doubleClose;
  });
  text = text.replace(/(^|[\s([{「『《【〈])'([^']*?)'/g, (_, before, content) =>
    `${before}${quotes.singleOpen}${content}${quotes.singleClose}`
  );
  return text;
}

export function convertToCJKCornerQuotes(text: string): string {
  return text.replace(/\u201c([^\u201d]*[\u4e00-\u9fff][^\u201d]*)\u201d/g, "「$1」");
}

export function convertNestedCornerQuotes(text: string): string {
  return text.replace(/「([^」]*)」/g, (_, content) => {
    const converted = content.replace(/\u2018([^\u2019]*)\u2019/g, "『$1』");
    return `「${converted}」`;
  });
}

function fixQuoteSpacing(text: string, openingQuote: string, closingQuote: string): string {
  const noSpaceBefore = CJK_CLOSING_BRACKETS + CJK_TERMINAL_PUNCTUATION;
  const noSpaceAfter = CJK_OPENING_BRACKETS + CJK_TERMINAL_PUNCTUATION;

  text = text.replace(
    new RegExp(`([A-Za-z0-9${CJK_ALL}${CJK_CLOSING_BRACKETS}${CJK_TERMINAL_PUNCTUATION}]|——)${openingQuote}`, "g"),
    (_, before) => noSpaceBefore.includes(before) ? `${before}${openingQuote}` : `${before} ${openingQuote}`
  );
  text = text.replace(
    new RegExp(`${closingQuote}([A-Za-z0-9${CJK_ALL}${CJK_OPENING_BRACKETS}${CJK_TERMINAL_PUNCTUATION}]|——)`, "g"),
    (_, after) => noSpaceAfter.includes(after) ? `${closingQuote}${after}` : `${closingQuote} ${after}`
  );
  return text;
}

export function fixDoubleQuoteSpacing(text: string): string {
  return fixQuoteSpacing(text, "\u201c", "\u201d");
}

export function fixSingleQuoteSpacing(text: string): string {
  return fixQuoteSpacing(text, "\u2018", "\u2019");
}

// Group 5: Cleanup
export function limitConsecutivePunctuation(text: string, limit: number): string {
  if (limit === 0) return text;
  const marks = ["！", "？", "。"];
  for (const mark of marks) {
    const escaped = mark.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (limit === 1) {
      text = text.replace(new RegExp(`${escaped}{2,}`, "g"), mark);
    } else if (limit === 2) {
      text = text.replace(new RegExp(`${escaped}{3,}`, "g"), mark + mark);
    }
  }
  return text;
}

export function removeTrailingSpaces(text: string): string {
  return text.replace(/ +$/gm, "");
}

/**
 * Apply all enabled CJK formatting rules
 */
export function applyRules(text: string, config: CJKFormattingSettings): string {
  // Group 1: Universal
  if (config.ellipsisNormalization) {
    text = normalizeEllipsis(text);
  }

  if (containsCJK(text)) {
    // Group 2: Fullwidth Normalization
    if (config.fullwidthAlphanumeric) text = normalizeFullwidthAlphanumeric(text);
    if (config.fullwidthPunctuation) text = normalizeFullwidthPunctuation(text);
    if (config.fullwidthBrackets) text = normalizeFullwidthBrackets(text);

    // Group 4: Dash & Quote (before spacing)
    if (config.dashConversion) text = convertDashes(text);
    if (config.emdashSpacing) text = fixEmdashSpacing(text);
    if (config.smartQuoteConversion) text = convertStraightToSmartQuotes(text, config.quoteStyle);
    if (config.cjkCornerQuotes && config.quoteStyle === "curly") text = convertToCJKCornerQuotes(text);
    if (config.cjkNestedQuotes) text = convertNestedCornerQuotes(text);
    if (config.quoteSpacing) text = fixDoubleQuoteSpacing(text);
    if (config.singleQuoteSpacing) text = fixSingleQuoteSpacing(text);

    // Group 3: Spacing
    if (config.cjkEnglishSpacing) text = addCJKEnglishSpacing(text);
    if (config.cjkParenthesisSpacing) text = addCJKParenthesisSpacing(text);
    if (config.fullwidthParentheses) text = normalizeFullwidthParentheses(text);
    if (config.currencySpacing) text = fixCurrencySpacing(text);
    if (config.slashSpacing) text = fixSlashSpacing(text);

    // Group 5: Cleanup (CJK-specific)
    if (config.consecutivePunctuationLimit > 0) {
      text = limitConsecutivePunctuation(text, config.consecutivePunctuationLimit);
    }
  }

  // Group 5: Universal cleanup
  if (config.spaceCollapsing) text = collapseSpaces(text);
  if (config.trailingSpaceRemoval) text = removeTrailingSpaces(text);
  if (config.newlineCollapsing) text = collapseNewlines(text);

  return text.trimEnd();
}
