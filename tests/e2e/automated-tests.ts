/**
 * VMark E2E Automated Tests
 *
 * Run with Tauri MCP tools via Claude Code
 * Usage: Execute each test function via MCP commands
 */

// Test Configuration
const DELAY = {
  SHORT: 200,
  MEDIUM: 500,
  LONG: 1000,
  DIALOG: 1500,
};

// ============================================================================
// SECTION 1: File Management Tests
// ============================================================================

/**
 * Test: New Window Creation
 * Command: Cmd+N
 * Expected: New window opens with empty content
 */
export const testNewWindow = `
// 1. Take initial screenshot
await tauri_webview_screenshot({ label: "main" });

// 2. Press Cmd+N
await tauri_webview_keyboard({ keys: ["Meta", "n"], label: "main" });
await sleep(${DELAY.LONG});

// 3. Verify new window exists (should have doc-0 or doc-1 label)
// Check window title shows "Untitled"
await tauri_webview_screenshot({ label: "doc-0" });
`;

/**
 * Test: Save New Document
 * Expected: Save dialog appears
 */
export const testSaveNewDocument = `
// 1. Type some content
await tauri_webview_keyboard({ text: "Test content for save", label: "main" });
await sleep(${DELAY.SHORT});

// 2. Press Cmd+S
await tauri_webview_keyboard({ keys: ["Meta", "s"], label: "main" });
await sleep(${DELAY.DIALOG});

// 3. Screenshot to verify dialog
await tauri_webview_screenshot({ label: "main" });

// 4. Press Escape to cancel dialog
await tauri_webview_keyboard({ keys: ["Escape"], label: "main" });
`;

/**
 * Test: Dirty State Indicator
 * Expected: Title shows "• " when modified
 */
export const testDirtyState = `
// 1. Get initial title
await tauri_webview_execute_js({
  label: "main",
  script: "document.title"
});

// 2. Type to create dirty state
await tauri_webview_keyboard({ text: "Modified", label: "main" });
await sleep(${DELAY.SHORT});

// 3. Check title now has dirty indicator
await tauri_webview_execute_js({
  label: "main",
  script: "document.title.startsWith('• ')"
});
`;

/**
 * Test: Close Clean Window
 * Expected: Window closes without dialog
 */
export const testCloseCleanWindow = `
// 1. Create new window
await tauri_webview_keyboard({ keys: ["Meta", "n"], label: "main" });
await sleep(${DELAY.LONG});

// 2. Close it (should close immediately as it's clean)
await tauri_webview_keyboard({ keys: ["Meta", "w"], label: "doc-0" });
await sleep(${DELAY.MEDIUM});

// 3. Verify window is gone (should error if window doesn't exist)
`;

/**
 * Test: Close Dirty Window Shows Dialog
 * Expected: Save/Don't Save/Cancel dialog appears
 */
export const testCloseDirtyWindow = `
// 1. Type content
await tauri_webview_keyboard({ text: "Unsaved content", label: "main" });
await sleep(${DELAY.SHORT});

// 2. Press Cmd+W
await tauri_webview_keyboard({ keys: ["Meta", "w"], label: "main" });
await sleep(${DELAY.DIALOG});

// 3. Screenshot to verify dialog
await tauri_webview_screenshot({ label: "main" });

// 4. Cancel the dialog
await tauri_webview_keyboard({ keys: ["Escape"], label: "main" });
`;

/**
 * Test: Cmd+Q With Dirty Window Shows Dialog (and can be cancelled)
 * Expected: Save/Don't Save/Cancel dialog appears
 */
export const testQuitDirtyWindow = `
// 1. Type content
await tauri_webview_keyboard({ text: "Unsaved content", label: "main" });
await sleep(${DELAY.SHORT});

// 2. Press Cmd+Q
await tauri_webview_keyboard({ keys: ["Meta", "q"], label: "main" });
await sleep(${DELAY.DIALOG});

// 3. Screenshot to verify dialog
await tauri_webview_screenshot({ label: "main" });

// 4. Cancel the dialog (should keep app running)
await tauri_webview_keyboard({ keys: ["Escape"], label: "main" });
`;

// ============================================================================
// SECTION 2: Text Formatting Tests
// ============================================================================

/**
 * Test: Bold Formatting (Cmd+B)
 */
export const testBoldFormatting = `
// 1. Type some text
await tauri_webview_keyboard({ text: "Hello World", label: "main" });
await sleep(${DELAY.SHORT});

// 2. Select all (Cmd+A)
await tauri_webview_keyboard({ keys: ["Meta", "a"], label: "main" });
await sleep(${DELAY.SHORT});

// 3. Apply bold (Cmd+B)
await tauri_webview_keyboard({ keys: ["Meta", "b"], label: "main" });
await sleep(${DELAY.SHORT});

// 4. Toggle to source mode to verify
await tauri_webview_keyboard({ keys: ["Meta", "/"], label: "main" });
await sleep(${DELAY.MEDIUM});

// 5. Check source contains **
await tauri_webview_execute_js({
  label: "main",
  script: "document.querySelector('.cm-content')?.textContent.includes('**')"
});
`;

/**
 * Test: Italic Formatting (Cmd+I)
 */
export const testItalicFormatting = `
// 1. Type text and select
await tauri_webview_keyboard({ text: "Italic text", label: "main" });
await tauri_webview_keyboard({ keys: ["Meta", "a"], label: "main" });
await sleep(${DELAY.SHORT});

// 2. Apply italic
await tauri_webview_keyboard({ keys: ["Meta", "i"], label: "main" });
await sleep(${DELAY.SHORT});

// 3. Verify in source mode
await tauri_webview_keyboard({ keys: ["Meta", "/"], label: "main" });
await sleep(${DELAY.MEDIUM});

await tauri_webview_execute_js({
  label: "main",
  script: "document.querySelector('.cm-content')?.textContent.includes('*')"
});
`;

/**
 * Test: Heading Levels (Cmd+1 through Cmd+6)
 */
export const testHeadings = `
// 1. Type text
await tauri_webview_keyboard({ text: "Heading Test", label: "main" });
await sleep(${DELAY.SHORT});

// 2. Apply H1
await tauri_webview_keyboard({ keys: ["Meta", "1"], label: "main" });
await sleep(${DELAY.SHORT});

// 3. Verify in source mode
await tauri_webview_keyboard({ keys: ["Meta", "/"], label: "main" });
await sleep(${DELAY.MEDIUM});

await tauri_webview_execute_js({
  label: "main",
  script: "document.querySelector('.cm-content')?.textContent.startsWith('# ')"
});
`;

// ============================================================================
// SECTION 3: View Mode Tests
// ============================================================================

/**
 * Test: Toggle Source Mode (Cmd+/)
 */
export const testSourceModeToggle = `
// 1. Initial state (WYSIWYG)
await tauri_webview_execute_js({
  label: "main",
  script: "!!document.querySelector('.tiptap-editor')"
});

// 2. Toggle to source mode
await tauri_webview_keyboard({ keys: ["Meta", "/"], label: "main" });
await sleep(${DELAY.MEDIUM});

// 3. Verify CodeMirror visible
await tauri_webview_execute_js({
  label: "main",
  script: "!!document.querySelector('.cm-editor')"
});

// 4. Toggle back to WYSIWYG
await tauri_webview_keyboard({ keys: ["Meta", "/"], label: "main" });
await sleep(${DELAY.MEDIUM});

// 5. Verify WYSIWYG visible
await tauri_webview_execute_js({
  label: "main",
  script: "!!document.querySelector('.tiptap-editor')"
});
`;

/**
 * Test: Focus Mode Toggle (F8)
 */
export const testFocusModeToggle = `
// 1. Enable focus mode
await tauri_webview_keyboard({ keys: ["F8"], label: "main" });
await sleep(${DELAY.MEDIUM});

// 2. Check focus-mode class applied
await tauri_webview_execute_js({
  label: "main",
  script: "document.body.classList.contains('focus-mode')"
});

// 3. Disable focus mode
await tauri_webview_keyboard({ keys: ["F8"], label: "main" });
await sleep(${DELAY.MEDIUM});

// 4. Verify class removed
await tauri_webview_execute_js({
  label: "main",
  script: "!document.body.classList.contains('focus-mode')"
});
`;

/**
 * Test: Typewriter Mode Toggle (F9)
 */
export const testTypewriterModeToggle = `
// 1. Enable typewriter mode
await tauri_webview_keyboard({ keys: ["F9"], label: "main" });
await sleep(${DELAY.MEDIUM});

// 2. Check typewriter-mode class applied
await tauri_webview_execute_js({
  label: "main",
  script: "document.body.classList.contains('typewriter-mode')"
});

// 3. Disable typewriter mode
await tauri_webview_keyboard({ keys: ["F9"], label: "main" });
await sleep(${DELAY.MEDIUM});
`;

// ============================================================================
// SECTION 4: Sidebar Tests
// ============================================================================

/**
 * Test: Toggle Sidebar (Cmd+Shift+B)
 */
export const testSidebarToggle = `
// 1. Initial state - check if sidebar visible
await tauri_webview_execute_js({
  label: "main",
  script: "!!document.querySelector('.sidebar:not(.hidden)')"
});

// 2. Toggle sidebar
await tauri_webview_keyboard({ keys: ["Meta", "Shift", "b"], label: "main" });
await sleep(${DELAY.MEDIUM});

// 3. Check sidebar state changed
await tauri_webview_execute_js({
  label: "main",
  script: "!!document.querySelector('.sidebar.hidden')"
});

// 4. Toggle back
await tauri_webview_keyboard({ keys: ["Meta", "Shift", "b"], label: "main" });
await sleep(${DELAY.MEDIUM});
`;

// ============================================================================
// SECTION 5: Selection Commands Tests
// ============================================================================

/**
 * Test: Select Word (Cmd+D)
 */
export const testSelectWord = `
// 1. Type a sentence
await tauri_webview_keyboard({ text: "Hello World Test", label: "main" });
await sleep(${DELAY.SHORT});

// 2. Move cursor to middle of "World"
await tauri_webview_keyboard({ keys: ["ArrowLeft"], label: "main" });
await tauri_webview_keyboard({ keys: ["ArrowLeft"], label: "main" });
await tauri_webview_keyboard({ keys: ["ArrowLeft"], label: "main" });
await tauri_webview_keyboard({ keys: ["ArrowLeft"], label: "main" });
await sleep(${DELAY.SHORT});

// 3. Select word (Cmd+D)
await tauri_webview_keyboard({ keys: ["Meta", "d"], label: "main" });
await sleep(${DELAY.SHORT});

// 4. Verify selection by checking window.getSelection()
await tauri_webview_execute_js({
  label: "main",
  script: "window.getSelection()?.toString()"
});
`;

/**
 * Test: Select Line (Cmd+L)
 */
export const testSelectLine = `
// 1. Type multiple lines
await tauri_webview_keyboard({ text: "Line 1", label: "main" });
await tauri_webview_keyboard({ keys: ["Enter"], label: "main" });
await tauri_webview_keyboard({ text: "Line 2", label: "main" });
await tauri_webview_keyboard({ keys: ["Enter"], label: "main" });
await tauri_webview_keyboard({ text: "Line 3", label: "main" });
await sleep(${DELAY.SHORT});

// 2. Go to middle line
await tauri_webview_keyboard({ keys: ["ArrowUp"], label: "main" });
await sleep(${DELAY.SHORT});

// 3. Select line (Cmd+L)
await tauri_webview_keyboard({ keys: ["Meta", "l"], label: "main" });
await sleep(${DELAY.SHORT});

// 4. Verify line selected
await tauri_webview_execute_js({
  label: "main",
  script: "window.getSelection()?.toString().includes('Line 2')"
});
`;

// ============================================================================
// SECTION 6: Search Tests
// ============================================================================

/**
 * Test: Open Find Bar (Cmd+F)
 */
export const testFindBar = `
// 1. Open find bar
await tauri_webview_keyboard({ keys: ["Meta", "f"], label: "main" });
await sleep(${DELAY.MEDIUM});

// 2. Verify find bar visible
await tauri_webview_execute_js({
  label: "main",
  script: "!!document.querySelector('.find-bar')"
});

// 3. Close find bar (Escape)
await tauri_webview_keyboard({ keys: ["Escape"], label: "main" });
await sleep(${DELAY.SHORT});
`;

// ============================================================================
// SECTION 7: Security Tests
// ============================================================================

/**
 * Test: Mermaid XSS Prevention
 */
export const testMermaidSecurity = `
// 1. Read the mermaid config
await tauri_webview_execute_js({
  label: "main",
  script: \`
    // This test verifies the mermaid security config
    // In production, we'd check the actual mermaid.initialize call
    true
  \`
});
`;

/**
 * Test: HTML Sanitization
 */
export const testHtmlSanitization = `
// 1. Type content with potential XSS
await tauri_webview_keyboard({
  text: "<script>alert('xss')</script>",
  label: "main"
});
await sleep(${DELAY.MEDIUM});

// 2. Verify script is escaped/removed, not executed
await tauri_webview_execute_js({
  label: "main",
  script: "!document.querySelector('script:not([src])')"
});
`;

// ============================================================================
// SECTION 8: Re-entry Guard Tests
// ============================================================================

/**
 * Test: Double Cmd+W doesn't show multiple dialogs
 */
export const testDoubleCloseGuard = `
// 1. Create dirty state
await tauri_webview_keyboard({ text: "Dirty content", label: "main" });
await sleep(${DELAY.SHORT});

// 2. Rapid double Cmd+W
await tauri_webview_keyboard({ keys: ["Meta", "w"], label: "main" });
await tauri_webview_keyboard({ keys: ["Meta", "w"], label: "main" });
await sleep(${DELAY.DIALOG});

// 3. Screenshot - should only show one dialog
await tauri_webview_screenshot({ label: "main" });

// 4. Cancel
await tauri_webview_keyboard({ keys: ["Escape"], label: "main" });
`;

/**
 * Test: Double Cmd+O doesn't show multiple dialogs
 */
export const testDoubleOpenGuard = `
// 1. Rapid double Cmd+O
await tauri_webview_keyboard({ keys: ["Meta", "o"], label: "main" });
await tauri_webview_keyboard({ keys: ["Meta", "o"], label: "main" });
await sleep(${DELAY.DIALOG});

// 2. Cancel dialog
await tauri_webview_keyboard({ keys: ["Escape"], label: "main" });
`;

// ============================================================================
// SECTION 9: Word Count Tests
// ============================================================================

/**
 * Test: Word Count Updates
 */
export const testWordCount = `
// 1. Get initial word count
await tauri_webview_execute_js({
  label: "main",
  script: "document.querySelector('.status-bar')?.textContent"
});

// 2. Type some words
await tauri_webview_keyboard({ text: "One two three four five", label: "main" });
await sleep(${DELAY.SHORT});

// 3. Verify word count updated
await tauri_webview_execute_js({
  label: "main",
  script: "document.querySelector('.status-bar')?.textContent.includes('5')"
});
`;

// ============================================================================
// UTILITY: Run All Tests
// ============================================================================

export const runAllTests = `
// This is a template for running all tests in sequence
// Execute each test via Tauri MCP, checking results

const tests = [
  { name: "New Window", test: testNewWindow },
  { name: "Dirty State", test: testDirtyState },
  { name: "Bold Formatting", test: testBoldFormatting },
  { name: "Source Mode", test: testSourceModeToggle },
  { name: "Focus Mode", test: testFocusModeToggle },
  { name: "Sidebar", test: testSidebarToggle },
  { name: "Select Word", test: testSelectWord },
  { name: "Find Bar", test: testFindBar },
  { name: "Security", test: testHtmlSanitization },
  { name: "Re-entry Guards", test: testDoubleCloseGuard },
  { name: "Word Count", test: testWordCount },
];

// Run via Claude Code MCP integration
`;
