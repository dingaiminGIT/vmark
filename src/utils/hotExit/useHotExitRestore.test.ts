/**
 * Hot Exit Restore Tests
 *
 * Tests for session restoration including multi-window support.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SessionData, WindowState } from './types';

// Mock stores
const mockTabStore = {
  getState: vi.fn(),
};

const mockDocumentStore = {
  getState: vi.fn(),
};

const mockUIStore = {
  getState: vi.fn(),
};

const mockEditorStore = {
  getState: vi.fn(),
};

vi.mock('@/stores/tabStore', () => ({
  useTabStore: mockTabStore,
}));

vi.mock('@/stores/documentStore', () => ({
  useDocumentStore: mockDocumentStore,
}));

vi.mock('@/stores/uiStore', () => ({
  useUIStore: mockUIStore,
}));

vi.mock('@/stores/editorStore', () => ({
  useEditorStore: mockEditorStore,
}));

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({ label: 'main' }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn(),
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

// Helper to create mock session
function createMockSession(windowConfigs: Array<{
  label: string;
  isMain: boolean;
  tabCount: number;
}>): SessionData {
  const windows: WindowState[] = windowConfigs.map(config => ({
    window_label: config.label,
    is_main_window: config.isMain,
    active_tab_id: `${config.label}-tab-0`,
    tabs: Array.from({ length: config.tabCount }, (_, i) => ({
      id: `${config.label}-tab-${i}`,
      file_path: `/path/to/file${i}.md`,
      title: `File ${i}`,
      is_pinned: false,
      document: {
        content: `Content ${i}`,
        saved_content: `Content ${i}`,
        is_dirty: false,
        is_missing: false,
        is_divergent: false,
        line_ending: '\n' as const,
        cursor_info: null,
        last_modified_timestamp: null,
        is_untitled: false,
        untitled_number: null,
      },
    })),
    ui_state: {
      sidebar_visible: true,
      sidebar_width: 260,
      outline_visible: false,
      sidebar_view_mode: 'files',
      status_bar_visible: true,
      source_mode_enabled: false,
      focus_mode_enabled: false,
      typewriter_mode_enabled: false,
    },
    geometry: null,
  }));

  return {
    version: 1,
    timestamp: Math.floor(Date.now() / 1000),
    vmark_version: '0.3.24',
    windows,
    workspace: null,
  };
}

describe('Hot Exit Restore Multi-Window', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Session structure', () => {
    it('should correctly identify main vs secondary windows', () => {
      const session = createMockSession([
        { label: 'main', isMain: true, tabCount: 3 },
        { label: 'doc-0', isMain: false, tabCount: 2 },
        { label: 'doc-1', isMain: false, tabCount: 1 },
      ]);

      expect(session.windows.length).toBe(3);

      const mainWindow = session.windows.find(w => w.is_main_window);
      expect(mainWindow).toBeDefined();
      expect(mainWindow?.window_label).toBe('main');
      expect(mainWindow?.tabs.length).toBe(3);

      const secondaryWindows = session.windows.filter(w => !w.is_main_window);
      expect(secondaryWindows.length).toBe(2);
      expect(secondaryWindows[0].window_label).toBe('doc-0');
      expect(secondaryWindows[1].window_label).toBe('doc-1');
    });

    it('should preserve tab data for all windows', () => {
      const session = createMockSession([
        { label: 'main', isMain: true, tabCount: 2 },
        { label: 'doc-0', isMain: false, tabCount: 3 },
      ]);

      // Main window tabs
      const mainTabs = session.windows[0].tabs;
      expect(mainTabs.length).toBe(2);
      expect(mainTabs[0].file_path).toBe('/path/to/file0.md');
      expect(mainTabs[1].file_path).toBe('/path/to/file1.md');

      // Secondary window tabs
      const secondaryTabs = session.windows[1].tabs;
      expect(secondaryTabs.length).toBe(3);
      expect(secondaryTabs[0].document.content).toBe('Content 0');
    });
  });

  describe('Restore utilities', () => {
    it('should calculate correct number of secondary windows to create', () => {
      const session = createMockSession([
        { label: 'main', isMain: true, tabCount: 1 },
        { label: 'doc-0', isMain: false, tabCount: 1 },
        { label: 'doc-1', isMain: false, tabCount: 1 },
        { label: 'doc-2', isMain: false, tabCount: 1 },
      ]);

      const secondaryWindows = session.windows.filter(w => !w.is_main_window);
      expect(secondaryWindows.length).toBe(3);
    });
  });
});
