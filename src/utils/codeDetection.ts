/**
 * Code Detection Utilities
 *
 * Heuristics to detect if clipboard content looks like source code
 * and optionally detect the programming language.
 */

export interface CodeDetectionResult {
  isCode: boolean;
  language: string | null;
  confidence: "high" | "medium" | "low";
}

/**
 * Common programming language keywords and patterns.
 */
const LANGUAGE_PATTERNS: Record<string, { keywords: RegExp[]; patterns: RegExp[] }> = {
  javascript: {
    keywords: [
      /\b(const|let|var|function|class|import|export|async|await|return|if|else|for|while)\b/,
      /\b(undefined|null|true|false|new|this|typeof|instanceof)\b/,
    ],
    patterns: [
      /=>\s*{/, // arrow functions
      /\(\s*\)\s*=>/, // arrow functions
      /\$\{[^}]+\}/, // template literals
      /require\s*\(/, // CommonJS
      /import\s+.*\s+from\s+['"]/, // ES modules
    ],
  },
  typescript: {
    keywords: [
      /\b(interface|type|enum|namespace|declare|readonly|as|implements|extends)\b/,
      /:\s*(string|number|boolean|void|any|unknown|never)\b/,
    ],
    patterns: [
      /<[A-Z][a-zA-Z]*>/, // generics
      /\?\s*:/, // optional properties
    ],
  },
  python: {
    keywords: [
      /\b(def|class|import|from|return|if|elif|else|for|while|with|as|try|except|finally|raise|yield|lambda|pass|break|continue)\b/,
      /\b(None|True|False|self|cls)\b/,
    ],
    patterns: [
      /^\s*def\s+\w+\s*\(/, // function definition
      /^\s*class\s+\w+/, // class definition
      /^\s*@\w+/, // decorators
      /:\s*$/, // colon at end of line
    ],
  },
  rust: {
    keywords: [
      /\b(fn|let|mut|const|struct|enum|impl|trait|pub|mod|use|crate|self|super|where|match|if|else|loop|while|for|return|break|continue)\b/,
      /\b(i8|i16|i32|i64|i128|u8|u16|u32|u64|u128|f32|f64|bool|char|str|String|Vec|Option|Result|Box|Rc|Arc)\b/,
    ],
    patterns: [
      /->/, // return type
      /::/, // path separator
      /&mut\s+\w+/, // mutable references
      /\?;/, // error propagation
      /#\[[\w:]+\]/, // attributes
    ],
  },
  go: {
    keywords: [
      /\b(func|var|const|type|struct|interface|package|import|return|if|else|for|range|switch|case|default|defer|go|chan|select|map|make|new)\b/,
    ],
    patterns: [
      /func\s+\(\w+\s+\*?\w+\)/, // method receiver
      /:=/, // short variable declaration
      /^\s*package\s+\w+/, // package declaration
      /^\s*import\s+[("]/,
    ],
  },
  java: {
    keywords: [
      /\b(public|private|protected|static|final|abstract|class|interface|extends|implements|void|new|return|if|else|for|while|try|catch|finally|throw|throws)\b/,
      /\b(int|long|double|float|boolean|char|byte|short|String|Integer|Long|Double|Boolean)\b/,
    ],
    patterns: [
      /@Override/, // annotations
      /System\.out\.print/, // common pattern
      /new\s+\w+\s*\(/, // object creation
    ],
  },
  cpp: {
    keywords: [
      /\b(class|struct|template|typename|namespace|using|public|private|protected|virtual|override|const|static|void|int|long|double|float|char|bool|auto|return|if|else|for|while|switch|case|default|break|continue|new|delete|nullptr|this)\b/,
    ],
    patterns: [
      /std::/, // standard library
      /#include\s*</, // includes
      /::/, // scope resolution
      /->/, // pointer member access
    ],
  },
  html: {
    keywords: [],
    patterns: [
      /<(!DOCTYPE|html|head|body|div|span|p|a|img|script|style|link|meta|form|input|button|table|tr|td|th|ul|ol|li|h[1-6])[^>]*>/i,
      /<\/\w+>/,
    ],
  },
  css: {
    keywords: [],
    patterns: [
      /[.#][\w-]+\s*\{/, // selectors
      /\{\s*[\w-]+\s*:/, // property declarations
      /@(import|media|keyframes|font-face)/,
    ],
  },
  json: {
    keywords: [],
    patterns: [
      /^\s*\{[\s\S]*\}\s*$/, // object
      /^\s*\[[\s\S]*\]\s*$/, // array
      /"[^"]+"\s*:\s*/, // key-value pairs
    ],
  },
  yaml: {
    keywords: [],
    patterns: [
      /^\s*[\w-]+:\s*[|>-]?\s*$/, // key with block scalar
      /^\s*[\w-]+:\s+\S/, // key with value
      /^\s*-\s+/, // list items
    ],
  },
  shell: {
    keywords: [
      /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|echo|export|source|alias|cd|pwd|ls|cat|grep|sed|awk|find|xargs)\b/,
    ],
    patterns: [
      /^\s*#!\//, // shebang
      /\$\{?\w+\}?/, // variable expansion
      /\|\s*\w+/, // pipes
      /&&\s*\w+/, // command chaining
    ],
  },
  sql: {
    keywords: [
      /\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TABLE|INDEX|VIEW|JOIN|INNER|LEFT|RIGHT|OUTER|ON|AND|OR|NOT|NULL|IN|LIKE|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|AS|DISTINCT)\b/i,
    ],
    patterns: [
      /^\s*SELECT\s+/i,
      /^\s*INSERT\s+INTO/i,
      /^\s*UPDATE\s+\w+\s+SET/i,
      /^\s*CREATE\s+TABLE/i,
    ],
  },
};

/**
 * Generic code patterns that indicate source code regardless of language.
 */
const GENERIC_CODE_PATTERNS = [
  // Consistent indentation (multiple lines with same indent)
  /^(\s{2,}|\t)\S/m,
  // Brackets and braces (common in most languages)
  /[{}[\]()]+/,
  // Assignment operators
  /[=!<>]=|[+\-*/%]=|\+\+|--/,
  // Logical operators
  /&&|\|\|/,
  // Comments
  /\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*/,
  // String literals with escapes
  /["'`].*\\[nrt\\'"]/,
  // Semicolons at end of lines
  /;\s*$/m,
  // Function-like patterns
  /\w+\s*\([^)]*\)/,
];

/**
 * Patterns that indicate NON-code content.
 */
const NON_CODE_PATTERNS = [
  // Prose-like sentences with proper capitalization and punctuation
  /^[A-Z][^.!?]*[.!?]\s*$/m,
  // Multiple sentences in paragraph form
  /[.!?]\s+[A-Z]/,
  // Common prose words at start
  /^(The|A|An|I|We|You|He|She|It|They|This|That|These|Those|In|On|At|For|To|From)\s/i,
];

/**
 * Calculate a score for how "code-like" the text is.
 */
function calculateCodeScore(text: string): number {
  let score = 0;
  const lines = text.split("\n");

  // Check for consistent indentation
  const indentedLines = lines.filter((line) => /^(\s{2,}|\t)\S/.test(line));
  if (indentedLines.length > lines.length * 0.3) {
    score += 3;
  }

  // Check generic code patterns
  for (const pattern of GENERIC_CODE_PATTERNS) {
    if (pattern.test(text)) {
      score += 1;
    }
  }

  // Check non-code patterns (reduce score)
  for (const pattern of NON_CODE_PATTERNS) {
    if (pattern.test(text)) {
      score -= 2;
    }
  }

  // High ratio of special characters to letters
  const specialChars = (text.match(/[{}()[\];:=<>+\-*/%&|!?]/g) || []).length;
  const letters = (text.match(/[a-zA-Z]/g) || []).length;
  if (letters > 0 && specialChars / letters > 0.1) {
    score += 2;
  }

  // Multiple lines with similar structure
  if (lines.length > 2) {
    const indentPattern = lines.slice(0, 5).map((l) => l.match(/^(\s*)/)?.[1]?.length || 0);
    const hasConsistentIndent = indentPattern.some((indent, i, arr) =>
      i > 0 && indent === arr[i - 1] && indent > 0
    );
    if (hasConsistentIndent) {
      score += 2;
    }
  }

  return score;
}

/**
 * Detect the likely programming language of the code.
 */
function detectLanguage(text: string): { language: string | null; score: number } {
  let bestMatch: { language: string | null; score: number } = { language: null, score: 0 };

  for (const [lang, { keywords, patterns }] of Object.entries(LANGUAGE_PATTERNS)) {
    let langScore = 0;

    // Check keywords (higher weight)
    for (const pattern of keywords) {
      const matches = text.match(new RegExp(pattern, "gm"));
      if (matches) {
        langScore += matches.length * 2;
      }
    }

    // Check patterns
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        langScore += 3;
      }
    }

    if (langScore > bestMatch.score) {
      bestMatch = { language: lang, score: langScore };
    }
  }

  return bestMatch;
}

/**
 * Detect if the given text is likely source code.
 *
 * @param text - The text to analyze
 * @returns Detection result with confidence level
 */
export function detectCode(text: string): CodeDetectionResult {
  if (!text || text.trim().length < 10) {
    return { isCode: false, language: null, confidence: "low" };
  }

  const trimmed = text.trim();

  // Quick checks for obvious code
  // Check if it starts with a shebang
  if (/^#!\//.test(trimmed)) {
    return { isCode: true, language: "shell", confidence: "high" };
  }

  // Check for JSON/YAML structure
  if (/^\s*\{[\s\S]*\}\s*$/.test(trimmed) || /^\s*\[[\s\S]*\]\s*$/.test(trimmed)) {
    // Looks like JSON
    try {
      JSON.parse(trimmed);
      return { isCode: true, language: "json", confidence: "high" };
    } catch {
      // Not valid JSON, might still be code
    }
  }

  // Calculate general code score
  const codeScore = calculateCodeScore(trimmed);

  // Detect language
  const { language, score: langScore } = detectLanguage(trimmed);

  // Combine scores
  const totalScore = codeScore + langScore;

  // Determine if it's code based on scores
  if (totalScore >= 8) {
    return { isCode: true, language, confidence: "high" };
  } else if (totalScore >= 4) {
    return { isCode: true, language, confidence: "medium" };
  } else if (totalScore >= 2 && langScore > 0) {
    return { isCode: true, language, confidence: "low" };
  }

  return { isCode: false, language: null, confidence: "low" };
}

/**
 * Check if text should be pasted as a code block.
 * More conservative than detectCode - only returns true for high confidence.
 */
export function shouldPasteAsCodeBlock(text: string): { should: boolean; language: string } {
  const result = detectCode(text);

  // Only auto-convert with high confidence
  if (result.isCode && result.confidence === "high") {
    return { should: true, language: result.language || "" };
  }

  return { should: false, language: "" };
}
