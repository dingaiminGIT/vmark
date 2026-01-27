/**
 * Tests for workspace tools.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VMarkMcpServer } from '../../../src/server.js';
import { MockBridge } from '../../mocks/mockBridge.js';
import { registerWorkspaceTools } from '../../../src/tools/workspace.js';

describe('Workspace Tools', () => {
  let bridge: MockBridge;
  let server: VMarkMcpServer;

  beforeEach(() => {
    bridge = new MockBridge();
    server = new VMarkMcpServer({ bridge });
    registerWorkspaceTools(server);
  });

  describe('workspace_list_windows', () => {
    it('should list windows', async () => {
      bridge.addWindow('secondary', { title: 'Second Window' });

      const result = await server.callTool('workspace_list_windows', {});

      expect(result.success).toBe(true);
      const windows = JSON.parse(result.content[0].text!);
      expect(windows).toHaveLength(2);
    });

    it('should send correct bridge request', async () => {
      await server.callTool('workspace_list_windows', {});

      const requests = bridge.getRequestsOfType('windows.list');
      expect(requests).toHaveLength(1);
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('Cannot list windows'));

      const result = await server.callTool('workspace_list_windows', {});

      expect(result.success).toBe(false);
      expect(result.content[0].text).toContain('Cannot list windows');
    });
  });

  describe('workspace_get_focused', () => {
    it('should return focused window label', async () => {
      const result = await server.callTool('workspace_get_focused', {});

      expect(result.success).toBe(true);
      expect(result.content[0].text).toBe('main');
    });

    it('should return updated focus', async () => {
      bridge.addWindow('secondary');
      bridge.setFocusedWindow('secondary');

      const result = await server.callTool('workspace_get_focused', {});

      expect(result.success).toBe(true);
      expect(result.content[0].text).toBe('secondary');
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('No focused window'));

      const result = await server.callTool('workspace_get_focused', {});

      expect(result.success).toBe(false);
    });
  });

  describe('workspace_focus_window', () => {
    it('should focus a window', async () => {
      const result = await server.callTool('workspace_focus_window', {
        windowId: 'main',
      });

      expect(result.success).toBe(true);
      expect(result.content[0].text).toContain('Focused window: main');
    });

    it('should send correct bridge request', async () => {
      await server.callTool('workspace_focus_window', { windowId: 'editor' });

      const requests = bridge.getRequestsOfType('windows.focus');
      expect(requests).toHaveLength(1);
      expect(requests[0].request.windowId).toBe('editor');
    });

    it('should reject empty windowId', async () => {
      const result = await server.callTool('workspace_focus_window', { windowId: '' });

      expect(result.success).toBe(false);
      expect(result.content[0].text).toContain('non-empty string');
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('Window not found'));

      const result = await server.callTool('workspace_focus_window', {
        windowId: 'unknown',
      });

      expect(result.success).toBe(false);
      expect(result.content[0].text).toContain('Window not found');
    });
  });

  describe('workspace_new_document', () => {
    it('should create new document', async () => {
      bridge.setResponseHandler('workspace.newDocument', () => ({
        success: true,
        data: { windowId: 'new-window-1' },
      }));

      const result = await server.callTool('workspace_new_document', {});

      expect(result.success).toBe(true);
      expect(result.content[0].text).toContain('new-window-1');
    });

    it('should create document with title', async () => {
      bridge.setResponseHandler('workspace.newDocument', (req) => ({
        success: true,
        data: { windowId: 'titled-window' },
      }));

      await server.callTool('workspace_new_document', { title: 'My Notes' });

      const requests = bridge.getRequestsOfType('workspace.newDocument');
      expect(requests[0].request.title).toBe('My Notes');
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('Cannot create document'));

      const result = await server.callTool('workspace_new_document', {});

      expect(result.success).toBe(false);
    });
  });

  describe('workspace_open_document', () => {
    it('should open document', async () => {
      bridge.setResponseHandler('workspace.openDocument', () => ({
        success: true,
        data: { windowId: 'opened-1' },
      }));

      const result = await server.callTool('workspace_open_document', {
        path: '/path/to/doc.md',
      });

      expect(result.success).toBe(true);
      expect(result.content[0].text).toContain('opened-1');
    });

    it('should send correct bridge request', async () => {
      bridge.setResponseHandler('workspace.openDocument', () => ({
        success: true,
        data: { windowId: 'test' },
      }));

      await server.callTool('workspace_open_document', { path: '/test/file.md' });

      const requests = bridge.getRequestsOfType('workspace.openDocument');
      expect(requests[0].request.path).toBe('/test/file.md');
    });

    it('should reject empty path', async () => {
      const result = await server.callTool('workspace_open_document', { path: '' });

      expect(result.success).toBe(false);
      expect(result.content[0].text).toContain('non-empty string');
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('File not found'));

      const result = await server.callTool('workspace_open_document', {
        path: '/nonexistent.md',
      });

      expect(result.success).toBe(false);
      expect(result.content[0].text).toContain('File not found');
    });
  });

  describe('workspace_save_document', () => {
    it('should save document', async () => {
      bridge.setResponseHandler('workspace.saveDocument', () => ({
        success: true,
        data: null,
      }));

      const result = await server.callTool('workspace_save_document', {});

      expect(result.success).toBe(true);
      expect(result.content[0].text).toContain('Document saved');
    });

    it('should use specified windowId', async () => {
      bridge.setResponseHandler('workspace.saveDocument', () => ({
        success: true,
        data: null,
      }));

      await server.callTool('workspace_save_document', { windowId: 'editor' });

      const requests = bridge.getRequestsOfType('workspace.saveDocument');
      expect(requests[0].request.windowId).toBe('editor');
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('Document is untitled'));

      const result = await server.callTool('workspace_save_document', {});

      expect(result.success).toBe(false);
      expect(result.content[0].text).toContain('Document is untitled');
    });
  });

  describe('workspace_close_window', () => {
    it('should close window', async () => {
      bridge.setResponseHandler('workspace.closeWindow', () => ({
        success: true,
        data: null,
      }));

      const result = await server.callTool('workspace_close_window', {});

      expect(result.success).toBe(true);
      expect(result.content[0].text).toContain('Window closed');
    });

    it('should use specified windowId', async () => {
      bridge.setResponseHandler('workspace.closeWindow', () => ({
        success: true,
        data: null,
      }));

      await server.callTool('workspace_close_window', { windowId: 'secondary' });

      const requests = bridge.getRequestsOfType('workspace.closeWindow');
      expect(requests[0].request.windowId).toBe('secondary');
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('Cannot close: unsaved changes'));

      const result = await server.callTool('workspace_close_window', {});

      expect(result.success).toBe(false);
      expect(result.content[0].text).toContain('unsaved changes');
    });
  });

  describe('workspace_list_recent_files', () => {
    it('should return empty message when no recent files', async () => {
      const result = await server.callTool('workspace_list_recent_files', {});

      expect(result.success).toBe(true);
      expect(result.content[0].text).toBe('No recent files');
    });

    it('should return list of recent files', async () => {
      bridge.addRecentFile('/path/to/file1.md', 'file1.md');
      bridge.addRecentFile('/path/to/file2.md', 'file2.md');

      const result = await server.callTool('workspace_list_recent_files', {});

      expect(result.success).toBe(true);
      const files = JSON.parse(result.content[0].text!);
      expect(files).toHaveLength(2);
      expect(files[0].path).toBe('/path/to/file2.md'); // Most recent first
      expect(files[0].name).toBe('file2.md');
      expect(files[0].timestamp).toBeDefined();
    });

    it('should send correct bridge request', async () => {
      await server.callTool('workspace_list_recent_files', {});

      const requests = bridge.getRequestsOfType('workspace.listRecentFiles');
      expect(requests).toHaveLength(1);
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('Storage error'));

      const result = await server.callTool('workspace_list_recent_files', {});

      expect(result.success).toBe(false);
      expect(result.content[0].text).toContain('Storage error');
    });
  });

  describe('workspace_get_info', () => {
    it('should return workspace info when not in workspace mode', async () => {
      const result = await server.callTool('workspace_get_info', {});

      expect(result.success).toBe(true);
      const info = JSON.parse(result.content[0].text!);
      expect(info.isWorkspaceMode).toBe(false);
      expect(info.rootPath).toBeNull();
      expect(info.workspaceName).toBeNull();
    });

    it('should return workspace info when in workspace mode', async () => {
      bridge.setWorkspaceInfo({
        isWorkspaceMode: true,
        rootPath: '/Users/test/my-project',
        workspaceName: 'my-project',
      });

      const result = await server.callTool('workspace_get_info', {});

      expect(result.success).toBe(true);
      const info = JSON.parse(result.content[0].text!);
      expect(info.isWorkspaceMode).toBe(true);
      expect(info.rootPath).toBe('/Users/test/my-project');
      expect(info.workspaceName).toBe('my-project');
    });

    it('should send correct bridge request with windowId', async () => {
      await server.callTool('workspace_get_info', { windowId: 'editor' });

      const requests = bridge.getRequestsOfType('workspace.getInfo');
      expect(requests).toHaveLength(1);
      expect(requests[0].request.windowId).toBe('editor');
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('Failed to read workspace'));

      const result = await server.callTool('workspace_get_info', {});

      expect(result.success).toBe(false);
      expect(result.content[0].text).toContain('Failed to read workspace');
    });
  });
});
