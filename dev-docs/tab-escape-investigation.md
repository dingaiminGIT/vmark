# Tab Escape Investigation Summary

**Date:** 2026-01-31
**Branch:** `feat/tab-escape-behaviors`
**Test Coverage:** 169 tests (168 passed, 1 skipped)

## Overview

Comprehensive investigation of all Tab escape behaviors in VMark, including WYSIWYG mode (TipTap) and Source mode (CodeMirror). This document summarizes findings from edge case testing and identifies known limitations.

## Test Files Created

1. **`src/plugins/tabIndent/tabEscape.edge-cases.test.ts`** (32 tests)
   - Multiple consecutive marks
   - Adjacent marks
   - Mark boundaries
   - Whitespace and special characters
   - Complex link scenarios
   - Empty and minimal cases
   - Multiple paragraphs
   - Selection edge cases

2. **`src/plugins/codemirror/tabEscape.edge-cases.test.ts`** (63 tests)
   - Link with special characters
   - Complex URLs (query params, anchors, encoded chars, mailto, data URLs)
   - Link with title attributes
   - Malformed links
   - Adjacent and nested structures
   - Reference-style links (not supported)
   - Autolinks (not supported)
   - Image syntax navigation
   - Closing character edge cases
   - CJK characters
   - Curly quotes
   - Priority testing

3. **`src/plugins/tabIndent/tabEscape.integration.test.ts`** (22 tests)
   - Complex nested structures (lists, blockquotes, combinations)
   - Multiple marks in sequence
   - Mixed content in nested structures
   - Edge cases at structure boundaries
   - Performance tests with large documents
   - Special selection types

4. **`src/plugins/tableUI/tableEscape.edge-cases.test.ts`** (40 tests)
   - Position detection edge cases
   - Complex document structures
   - Boundary conditions
   - Theoretical integration scenarios
   - Performance edge cases

## Behaviors Verified

### WYSIWYG Tab Escape (TipTap)

✅ **Working correctly:**
- Escaping from bold, italic, code, strike marks
- Escaping from links (takes priority over marks)
- Multiple consecutive marks on same text
- Adjacent marks
- Marks at document boundaries
- Marks with emoji and CJK characters
- Marks in nested structures (lists, blockquotes)
- Link + mark combinations (link takes priority)
- Performance with large documents (<10ms)
- Very long marked text
- Selection handling (correctly prevents escape)

⚠️ **Known limitations:**
1. **Cursor at exact mark start** - Marks might not be active at exact boundary position (depends on ProseMirror's storedMarks)
2. **Empty text nodes** - ProseMirror prevents empty text nodes, so zero-width marks don't exist
3. **Single character marks** - Edge case where cursor position matters (start vs inside)

### Source Mode Tab Escape (CodeMirror)

✅ **Working correctly:**
- Link navigation: `[text]` → `(url)` → outside
- Jumping over closing chars: `), ], }, ", ', `, >`
- Markdown format chars: `*, _, ^`
- Multi-char sequences: `~~, ==`
- CJK closing brackets: `）, 】, 」, 』, 》, 〉`
- Curly quotes: `", '` (U+201D, U+2019)
- Complex URLs (query params, anchors, encoded chars)
- Relative and absolute paths
- Data URLs and mailto links
- Link with title attributes (all quote styles)
- Adjacent links (uses link containing cursor)
- Links in bold/lists/blockquotes
- Image syntax `![alt](url)` (works same as links)
- Priority: link navigation > closing char jump

⚠️ **Known limitations:**
1. **Escaped brackets in link text** - Regex doesn't handle `[text \[escaped\]](url)` correctly (would need sophisticated parser)
2. **Reference-style links** - Not supported: `[text][ref]`
3. **Link definitions** - Not supported: `[ref]: url`
4. **Autolinks** - Not supported: `<https://example.com>`
5. **Links inside code** - Cannot detect context: `` `[text](url)` `` is treated as link

### Table Escape

✅ **Working correctly:**
- Position detection for first/last block
- Boundary condition handling
- Multiple tables in document
- Very large tables (performance)

⚠️ **Note:** Integration tests require full Tiptap setup and are better suited for E2E tests.

## Edge Cases Identified

### 1. Mark Boundary Behavior

**Issue:** When cursor is exactly at the start position of a mark, the mark might not be considered "active" yet.

**Example:**
```typescript
"hello **bold**"
      ^cursor here (position 7)
```

**Why:** ProseMirror's mark activation depends on `storedMarks` at boundaries.

**Impact:** Minimal - users typically type inside marks, not at exact boundaries.

### 2. Escaped Characters in Markdown

**Issue:** Simple regex-based link detection doesn't handle escaped characters properly.

**Example:**
```markdown
[text \[with brackets\]](url)
```

**Why:** Would need a full markdown parser to handle all escape sequences.

**Impact:** Low - rare use case.

**Workaround:** Users can navigate manually in these cases.

### 3. Reference Links Not Supported

**Issue:** Reference-style links use different syntax.

**Example:**
```markdown
[text][ref]

[ref]: https://example.com
```

**Why:** Different syntax pattern, would need separate handler.

**Impact:** Low - inline links are more common.

### 4. Context-Unaware Detection

**Issue:** Cannot detect if link syntax is inside code block.

**Example:**
````markdown
`[text](url)` <- This is code, not a link
````

**Why:** CodeMirror tab escape runs on raw text without full syntax context.

**Impact:** Low - users can use regular Tab in code blocks.

## Performance Results

All tests completed with excellent performance:

| Scenario | Time | Status |
|----------|------|--------|
| Large document (100 paragraphs) | <10ms | ✅ Pass |
| Very long marked text (10k chars) | <10ms | ✅ Pass |
| Complex nested structures | <5ms | ✅ Pass |

## Test Statistics

- **Total Test Files:** 5
- **Total Tests:** 169
- **Passed:** 168 (99.4%)
- **Skipped:** 1 (nested brackets - known limitation)
- **Failed:** 0
- **Duration:** ~120ms

## Recommendations

### High Priority: None
All critical functionality works correctly.

### Medium Priority

1. **Consider adding escaped bracket support** for link text
   - Would improve handling of complex markdown
   - Requires more sophisticated parser
   - Low priority due to rare usage

2. **Add visual feedback** when Tab escapes
   - Brief highlight or animation
   - Helps users understand what happened
   - UX enhancement

### Low Priority

1. **Support reference-style links**
   - Different user workflow
   - Less common in WYSIWYG editors

2. **Support autolinks**
   - Minor convenience
   - Easy workaround: convert to regular link

## Known Issues (Non-Blocking)

1. **Cursor at mark boundaries** - ProseMirror behavior, not a bug
2. **Escaped brackets in links** - Rare edge case, documented
3. **Context-unaware in code** - Acceptable limitation

## Conclusion

Tab escape functionality is **robust and well-tested** across all modes:

- ✅ WYSIWYG mode handles all escapable marks correctly
- ✅ Source mode handles link navigation and closing chars
- ✅ Performance is excellent even with large documents
- ✅ Edge cases are properly handled or documented
- ✅ Known limitations have minimal impact

The system is **production-ready** with comprehensive test coverage.
