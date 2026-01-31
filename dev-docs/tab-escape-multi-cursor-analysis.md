# Tab Escape Multi-Cursor Interaction Analysis

**Date:** 2026-01-31 (Investigation)
**Implementation Date:** 2026-01-31
**Status:** ✅ **FULLY IMPLEMENTED**
**Priority:** Medium (power user feature, not critical path)

---

## ✅ IMPLEMENTATION COMPLETE (2026-01-31)

**Option 1 (Independent Cursor Handling) has been fully implemented.**

### What Was Implemented

- **WYSIWYG Mode:** `canTabEscape()` now returns `MultiSelection` with independently processed cursors
- **Source Mode:** `handleMultiCursorEscape()` processes each range independently
- **Each cursor:** Calculates its own escape position for marks/links/closing chars
- **Test Coverage:** All 202 tab escape tests passing, including 34 multi-cursor tests

### Implementation Details

```typescript
// WYSIWYG: canTabEscape() now handles MultiSelection
if (selection instanceof MultiSelection) {
  return canTabEscapeMulti(state); // Returns MultiSelection with updated positions
}

// CodeMirror: handleMultiCursorEscape() processes each range
if (state.selection.ranges.length > 1) {
  return handleMultiCursorEscape(view); // Returns true if any cursor escaped
}
```

### Commit

- **Commit:** 578360e - "feat(tab-escape): implement full multi-cursor support"
- **Files Modified:** 5 files, 307 insertions, 33 deletions
- **Tests:** 202 passing (1 skipped)

---

## Original Investigation (Below)

This analysis was conducted before implementation to understand the undefined behavior and design solutions.

### Critical Findings (Original Investigation)

1. ⚠️ **WYSIWYG (TipTap):** Tab escape ignores all but primary cursor (NOW FIXED ✅)
2. ⚠️ **Source Mode (CodeMirror):** Tab escape checks only primary range (NOW FIXED ✅)
3. ⚠️ **No explicit multi-cursor handling** in any Tab escape code (NOW FIXED ✅)
4. ⚠️ **Falls through to space insertion** (unintended but functional) (NOW FIXED ✅)
5. ✅ **No crashes or data corruption** - gracefully degrades

## Current Behavior Analysis

### WYSIWYG Mode (TipTap)

**Implementation:** `src/plugins/tabIndent/tabEscape.ts`

```typescript
export function canTabEscape(state: EditorState): TabEscapeResult | null {
  const { selection } = state;
  const { from, to } = selection;

  // Only handle cursor, not selection
  if (from !== to) return null;  // ← PROBLEM: Checks only primary!

  // ... rest of escape logic
}
```

**Issue:**
- For `MultiSelection`, `selection.from/to` refers to **primary range only**
- Secondary cursors are completely ignored
- Returns `null` for any MultiSelection → falls through to space insertion

**Test Results:**
```typescript
// Two cursors: one in **bold**, one in plain text
Cursor 1: inside "bold" → could escape
Cursor 2: in plain text → cannot escape

Actual: canTabEscape returns null → inserts spaces at both positions
Expected: Cursor 1 jumps to end of bold, Cursor 2 inserts space
```

---

### Source Mode (CodeMirror)

**Implementation:** `src/plugins/codemirror/tabEscape.ts`

```typescript
export const tabEscapeKeymap: KeyBinding = {
  key: "Tab",
  run: (view) => {
    const { state } = view;
    const { from, to } = state.selection.main;  // ← PROBLEM: Only checks .main!

    if (from !== to) return false;  // Ignores other ranges

    // ... rest of escape logic
  },
};
```

**Issue:**
- Checks `selection.main` (primary range) only
- `state.selection.ranges` array is never examined
- Secondary cursors ignored completely

**Test Results:**
```typescript
// Two cursors in different [links](url)
Cursor 1: in [first](url1)
Cursor 2: in [second](url2)

Actual: Only primary cursor navigates within link
Expected: Both cursors navigate within their respective links
```

---

## Behavior Matrix

| Scenario | WYSIWYG Actual | WYSIWYG Expected | CodeMirror Actual | CodeMirror Expected |
|----------|---------------|------------------|-------------------|---------------------|
| Two cursors in marks | ❌ Insert spaces | ✅ Escape both | ❌ Insert spaces | ✅ Escape both |
| One in mark, one plain | ❌ Insert spaces | ⚠️ Mixed behavior | ❌ Insert spaces | ⚠️ Mixed behavior |
| Two cursors in links | ❌ Insert spaces | ✅ Navigate both | ⚠️ Primary only | ✅ Navigate both |
| Cursor + Selection | ❌ Replace with spaces | ✅ Replace with spaces | ❌ Replace with spaces | ✅ Replace with spaces |
| Before closing chars | ❌ Insert spaces | ✅ Jump all | ⚠️ Primary only | ✅ Jump all |

Legend:
- ✅ Correct behavior
- ⚠️ Partial/inconsistent
- ❌ Not working as expected

---

## Root Cause Analysis

### 1. Selection Model Mismatch

**TipTap (ProseMirror):**
```typescript
// Regular selection
interface Selection {
  from: number;    // Start of PRIMARY range
  to: number;      // End of PRIMARY range
  ranges?: SelectionRange[];  // All ranges (if multi)
}

// MultiSelection
class MultiSelection {
  ranges: SelectionRange[];     // All cursor positions
  primaryIndex: number;         // Which is primary
}
```

**Problem:** `canTabEscape` uses `selection.from/to` which only represents primary!

---

**CodeMirror:**
```typescript
interface EditorSelection {
  main: SelectionRange;    // Primary range
  ranges: SelectionRange[]; // All ranges including main
}
```

**Problem:** `tabEscape` uses `selection.main` only!

---

### 2. No Multi-Range Transaction Logic

Current escape logic creates transactions like:
```typescript
// Single cursor jump
tr.setSelection(TextSelection.create(doc, targetPos))
```

For multi-cursor, need:
```typescript
// Multiple cursor jumps
const newRanges = ranges.map(range => {
  const escapePos = calculateEscape(range);
  return new SelectionRange(doc.resolve(escapePos));
});
tr.setSelection(new MultiSelection(newRanges, primaryIndex));
```

This logic **doesn't exist** in current implementation.

---

### 3. Multi-Cursor Plugin Doesn't Handle Tab

**TipTap:** `src/plugins/multiCursor/inputHandling.ts`
- Handles: typing, Backspace, Delete, Arrow keys
- **Doesn't handle: Tab** (not in switch statement)

**CodeMirror:** `src/plugins/codemirror/sourceMultiCursorPlugin.ts`
- Handles: Escape (collapse), Alt+Click (add/remove)
- **Doesn't handle: Tab**

Tab is left to fall through to default handlers, which don't understand multi-cursor context.

---

## Edge Cases Identified

### 1. Overlapping Ranges in Same Link

```typescript
// Two cursors in same link
[te|xt| he|re](url)
   ^1  ^2  ^3

// What should happen?
Option A: All jump to (url) → merge into one cursor
Option B: All jump to (url) → keep as three cursors
Option C: Only primary jumps, others stay
```

**Current:** Returns null → inserts spaces ❌

---

### 2. Mixed Escapable Contexts

```typescript
// Cursor in bold, cursor in link, cursor in plain
**bo|ld** and [li|nk](url) and pla|in
     ^1          ^2              ^3

// What should happen?
Option A: All that CAN escape DO escape
  - Cursor 1 → after bold
  - Cursor 2 → to (url)
  - Cursor 3 → stays in place

Option B: Only if ALL can escape
  - None escape → all insert spaces

Option C: Only primary escapes
  - Cursor 2 (primary) → navigates
  - Cursors 1,3 → stay
```

**Current:** Returns null → all insert spaces ❌

---

### 3. Before Different Closing Chars

```typescript
// Source mode: cursors before different closing chars
text|) and more|] and end|}
    ^1         ^2        ^3

// What should happen?
- Cursor 1 → jump over )
- Cursor 2 → jump over ]
- Cursor 3 → jump over }
```

**Current:** Primary only checks ❌

---

### 4. Link Navigation Sequence

```typescript
// Two cursors at different stages of link navigation
[te|xt](ur|l)
   ^1     ^2

Tab press 1:
  - Cursor 1: [text] → (url)
  - Cursor 2: (url) → outside

Result: Two cursors at different positions
  [text](|url)|
         ^1   ^2
```

**Current:** Primary only ❌

---

## Impact Assessment

### Severity: **Medium**

**Why not Critical:**
- Doesn't crash or corrupt data
- Falls through to predictable behavior (space insertion)
- Multi-cursor is power user feature, not mainstream

**Why not Low:**
- Tab escape is documented feature
- Multi-cursor is supported elsewhere in VMark
- Inconsistent behavior hurts power user trust
- Falls below user expectations for VS Code-style editing

---

### Affected Users

**Who notices:**
- Power users with VS Code/Sublime background
- Users who rely on multi-cursor for bulk editing
- Users who combine multi-cursor + Tab escape workflows

**Who doesn't notice:**
- Users who don't use multi-cursor
- Users who don't use Tab escape
- Casual users (majority)

**Usage frequency estimate:**
- Multi-cursor: 20% of users
- Tab escape: 40% of users
- Both together: ~5% of users

---

## Recommended Solutions

### Option 1: Independent Cursor Handling (Best UX)

**Approach:** Handle each cursor independently

**Implementation:**
```typescript
// For each range in MultiSelection:
// - Calculate escape position (if applicable)
// - Keep position if cannot escape
// - Build new MultiSelection with all new positions

export function canTabEscapeMulti(state: EditorState): MultiSelection | null {
  const { selection } = state;

  if (!(selection instanceof MultiSelection)) {
    return null; // Use existing single-cursor logic
  }

  const newRanges: SelectionRange[] = [];

  for (const range of selection.ranges) {
    if (range.from !== range.to) {
      // Selection, not cursor - keep as-is
      newRanges.push(range);
      continue;
    }

    // Check if this cursor can escape
    const escapePos = calculateEscapeForPosition(state, range.from);

    if (escapePos !== null) {
      // Can escape - move cursor
      newRanges.push(new SelectionRange(
        state.doc.resolve(escapePos),
        state.doc.resolve(escapePos)
      ));
    } else {
      // Cannot escape - keep position
      newRanges.push(range);
    }
  }

  return new MultiSelection(newRanges, selection.primaryIndex);
}
```

**Pros:**
- Most intuitive UX
- Matches user expectations from VS Code/Sublime
- Each cursor behaves independently
- Powerful for bulk editing

**Cons:**
- Most complex implementation
- Need to handle all escape types (marks, links, closing chars)
- Potential for confusing behavior when cursors don't all move

**Effort:** High (2-3 days)

---

### Option 2: Primary-Only Handling (Simple)

**Approach:** Only escape primary cursor, keep others unchanged

**Implementation:**
```typescript
export function canTabEscape(state: EditorState): TabEscapeResult | null {
  const { selection } = state;

  // Extract primary range (works for both Selection and MultiSelection)
  const primaryRange = selection instanceof MultiSelection
    ? selection.ranges[selection.primaryIndex]
    : { from: selection.from, to: selection.to };

  if (primaryRange.from !== primaryRange.to) return null;

  // ... existing escape logic using primaryRange ...
}
```

**Pros:**
- Minimal code change
- Clear, predictable behavior
- Works with existing escape logic

**Cons:**
- Asymmetric behavior (primary vs secondary)
- Less powerful for bulk editing
- May confuse users (why only one cursor moves?)

**Effort:** Low (half day)

---

### Option 3: Disable for Multi-Cursor (Explicit)

**Approach:** Return false when multi-cursor detected

**Implementation:**
```typescript
export function canTabEscape(state: EditorState): TabEscapeResult | null {
  const { selection } = state;

  // Explicitly disable for multi-cursor
  if (selection instanceof MultiSelection) {
    return null; // Fall through to space insertion
  }

  const { from, to } = selection;
  if (from !== to) return null;

  // ... existing escape logic ...
}
```

**Pros:**
- Explicit and documented limitation
- No unexpected behavior
- Preserves current (accidental) behavior
- Zero complexity

**Cons:**
- Limits power user workflows
- Below expectations for VS Code-style editor
- Feature gap vs competitors

**Effort:** Minimal (1 hour for documentation)

---

### Option 4: Hybrid Approach (Recommended)

**Approach:** Start with Option 3 (explicit disable), plan Option 1 for future

**Phase 1 (Immediate):**
1. Add explicit multi-cursor check
2. Document limitation in release notes
3. Add tests confirming behavior
4. Create GitHub issue for full support

**Phase 2 (Future enhancement):**
1. Implement Option 1 (independent cursor handling)
2. Add comprehensive tests
3. Beta test with power users
4. Ship as "Multi-Cursor Tab Escape" feature

**Pros:**
- Safe immediate fix
- Clear path forward
- Manages user expectations
- Allows time for proper implementation

**Cons:**
- Two-phase rollout
- Users wait for full feature

**Effort:**
- Phase 1: 4 hours
- Phase 2: 2-3 days

---

## Test Plan

### Test Matrix

| Scenario | Single Cursor | Multi-Cursor (2) | Multi-Cursor (3+) |
|----------|---------------|------------------|-------------------|
| In marks | ✅ Tested | ⚠️ New tests | ⚠️ New tests |
| In links | ✅ Tested | ⚠️ New tests | ⚠️ New tests |
| Before closing chars | ✅ Tested | ⚠️ New tests | ⚠️ New tests |
| Mixed contexts | ✅ Tested | ⚠️ New tests | ⚠️ New tests |
| With selections | ✅ Tested | ⚠️ New tests | ⚠️ New tests |

### New Test Files Created

1. **`tabEscape.multi-cursor.test.ts`** (WYSIWYG) - 15 tests ✅
2. **`tabEscape.multi-cursor.test.ts`** (CodeMirror) - 19 tests ✅

### Tests Needed for Full Implementation

1. Independent cursor escape in marks
2. Independent cursor escape in links
3. Independent cursor before closing chars
4. Mixed escapable/non-escapable contexts
5. Overlapping ranges in same link
6. Link navigation progression with multi-cursor
7. Undo/redo with multi-cursor escape
8. Performance with 100+ cursors

---

## Recommendations

### Immediate Action (This Week)

✅ **Option 3: Explicit Disable**
- Add multi-cursor guard clause
- Update documentation
- Add tests confirming limitation
- Create GitHub issue: "Support Tab escape with multi-cursor"

**Code changes:**
```typescript
// tabEscape.ts
if (selection instanceof MultiSelection) {
  return null; // Documented limitation
}

// tabEscape.ts (CodeMirror)
if (state.selection.ranges.length > 1) {
  return false; // Documented limitation
}
```

**Documentation:**
```markdown
## Known Limitations

- Tab escape is disabled when multiple cursors are active
- Use Escape to collapse to single cursor, then use Tab escape
- Full multi-cursor support planned for future release
```

---

### Future Enhancement (Next Quarter)

🎯 **Option 1: Independent Cursor Handling**
- Implement for WYSIWYG mode first
- Then port to Source mode
- Extensive testing with power users
- Ship as v0.4.0 feature

**Success Criteria:**
- All cursors in escapable contexts escape independently
- Cursors in plain text stay in place
- No performance degradation with 100 cursors
- Undo/redo works correctly
- User testing shows positive feedback

---

## Conclusion

**Current Status:** ⚠️ Undefined behavior - graceful degradation to space insertion

**Risk Level:** Medium (power user feature, not critical path)

**Recommended Path:**
1. **Immediate:** Add explicit multi-cursor guard clause (4 hours)
2. **Document:** Known limitation in release notes
3. **Plan:** Full support in future release (Q2 2026)

**Rationale:**
- Explicit behavior > undefined behavior
- Manages user expectations
- Allows time for proper implementation
- No risk of breaking existing workflows
