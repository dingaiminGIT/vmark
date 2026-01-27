/**
 * Tests for tab tools.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VMarkMcpServer } from '../../../src/server.js';
import { MockBridge } from '../../mocks/mockBridge.js';
import { registerTabTools } from '../../../src/tools/tabs.js';

describe('Tab Tools', () => {
  let bridge: MockBridge;
  let server: VMarkMcpServer;

  beforeEach(() => {
    bridge = new MockBridge();
    server = new VMarkMcpServer({ bridge });
    registerTabTools(server);
  });

  describe('tabs_list', () => {
    it('should list tabs in a window', async () => {
      bridge.setResponseHandler('tabs.list', () => ({
        success: true,
        data: [
          { id: 'tab-1', title: 'Untitled', filePath: null, isDirty: false, isActive: true },
          { id: 'tab-2', title: 'notes.md', filePath: '/path/to/notes.md', isDirty: true, isActive: false },
        ],
      }));

      const result = await server.callTool('tabs_list', {});

      expect(result.success).toBe(true);
      const tabs = JSON.parse(result.content[0].text!);
      expect(tabs).toHaveLength(2);
      expect(tabs[0].id).toBe('tab-1');
      expect(tabs[1].isDirty).toBe(true);
    });

    it('should send correct bridge request', async () => {
      bridge.setResponseHandler('tabs.list', () => ({
        success: true,
        data: [],
      }));

      await server.callTool('tabs_list', { windowId: 'editor' });

      const requests = bridge.getRequestsOfType('tabs.list');
      expect(requests).toHaveLength(1);
      expect(requests[0].request.windowId).toBe('editor');
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('Cannot list tabs'));

      const result = await server.callTool('tabs_list', {});

      expect(result.success).toBe(false);
      expect(result.content[0].text).toContain('Cannot list tabs');
    });
  });

  describe('tabs_get_active', () => {
    it('should return active tab info', async () => {
      bridge.setResponseHandler('tabs.getActive', () => ({
        success: true,
        data: { id: 'tab-1', title: 'Untitled', filePath: null, isDirty: false, isActive: true },
      }));

      const result = await server.callTool('tabs_get_active', {});

      expect(result.success).toBe(true);
      const tab = JSON.parse(result.content[0].text!);
      expect(tab.id).toBe('tab-1');
      expect(tab.isActive).toBe(true);
    });

    it('should handle no active tab', async () => {
      bridge.setResponseHandler('tabs.getActive', () => ({
        success: true,
        data: null,
      }));

      const result = await server.callTool('tabs_get_active', {});

      expect(result.success).toBe(false);
      expect(result.content[0].text).toContain('No active tab');
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('Window not found'));

      const result = await server.callTool('tabs_get_active', {});

      expect(result.success).toBe(false);
    });
  });

  describe('tabs_switch', () => {
    it('should switch to a tab', async () => {
      bridge.setResponseHandler('tabs.switch', () => ({
        success: true,
        data: null,
      }));

      const result = await server.callTool('tabs_switch', { tabId: 'tab-2' });

      expect(result.success).toBe(true);
      expect(result.content[0].text).toContain('Switched to tab: tab-2');
    });

    it('should send correct bridge request', async () => {
      bridge.setResponseHandler('tabs.switch', () => ({
        success: true,
        data: null,
      }));

      await server.callTool('tabs_switch', { tabId: 'tab-3', windowId: 'editor' });

      const requests = bridge.getRequestsOfType('tabs.switch');
      expect(requests).toHaveLength(1);
      expect(requests[0].request.tabId).toBe('tab-3');
      expect(requests[0].request.windowId).toBe('editor');
    });

    it('should reject empty tabId', async () => {
      const result = await server.callTool('tabs_switch', { tabId: '' });

      expect(result.success).toBe(false);
      expect(result.content[0].text).toContain('non-empty string');
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('Tab not found'));

      const result = await server.callTool('tabs_switch', { tabId: 'unknown' });

      expect(result.success).toBe(false);
      expect(result.content[0].text).toContain('Tab not found');
    });
  });

  describe('tabs_close', () => {
    it('should close a specific tab', async () => {
      bridge.setResponseHandler('tabs.close', () => ({
        success: true,
        data: null,
      }));

      const result = await server.callTool('tabs_close', { tabId: 'tab-1' });

      expect(result.success).toBe(true);
      expect(result.content[0].text).toContain('Closed tab: tab-1');
    });

    it('should close active tab when tabId not specified', async () => {
      bridge.setResponseHandler('tabs.close', () => ({
        success: true,
        data: null,
      }));

      const result = await server.callTool('tabs_close', {});

      expect(result.success).toBe(true);
      expect(result.content[0].text).toContain('Closed active tab');
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('Cannot close: unsaved changes'));

      const result = await server.callTool('tabs_close', { tabId: 'tab-1' });

      expect(result.success).toBe(false);
      expect(result.content[0].text).toContain('unsaved changes');
    });
  });

  describe('tabs_create', () => {
    it('should create a new tab', async () => {
      bridge.setResponseHandler('tabs.create', () => ({
        success: true,
        data: { tabId: 'new-tab-1' },
      }));

      const result = await server.callTool('tabs_create', {});

      expect(result.success).toBe(true);
      expect(result.content[0].text).toContain('Created new tab: new-tab-1');
    });

    it('should send correct bridge request', async () => {
      bridge.setResponseHandler('tabs.create', () => ({
        success: true,
        data: { tabId: 'new-tab-1' },
      }));

      await server.callTool('tabs_create', { windowId: 'editor' });

      const requests = bridge.getRequestsOfType('tabs.create');
      expect(requests).toHaveLength(1);
      expect(requests[0].request.windowId).toBe('editor');
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('Cannot create tab'));

      const result = await server.callTool('tabs_create', {});

      expect(result.success).toBe(false);
    });
  });

  describe('tabs_get_info', () => {
    it('should return tab info', async () => {
      bridge.setResponseHandler('tabs.getInfo', () => ({
        success: true,
        data: { id: 'tab-1', title: 'notes.md', filePath: '/path/to/notes.md', isDirty: true, isActive: true },
      }));

      const result = await server.callTool('tabs_get_info', { tabId: 'tab-1' });

      expect(result.success).toBe(true);
      const tab = JSON.parse(result.content[0].text!);
      expect(tab.title).toBe('notes.md');
      expect(tab.isDirty).toBe(true);
    });

    it('should return active tab info when tabId not specified', async () => {
      bridge.setResponseHandler('tabs.getInfo', () => ({
        success: true,
        data: { id: 'tab-active', title: 'Untitled', filePath: null, isDirty: false, isActive: true },
      }));

      const result = await server.callTool('tabs_get_info', {});

      expect(result.success).toBe(true);
      const tab = JSON.parse(result.content[0].text!);
      expect(tab.id).toBe('tab-active');
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('Tab not found'));

      const result = await server.callTool('tabs_get_info', { tabId: 'unknown' });

      expect(result.success).toBe(false);
      expect(result.content[0].text).toContain('Tab not found');
    });
  });

  describe('tabs_reopen_closed', () => {
    it('should reopen a closed tab', async () => {
      bridge.addClosedTab({ id: 'tab-closed-1', filePath: '/path/to/closed.md', title: 'closed.md' });

      const result = await server.callTool('tabs_reopen_closed', {});

      expect(result.success).toBe(true);
      const reopened = JSON.parse(result.content[0].text!);
      expect(reopened.tabId).toBe('tab-closed-1');
      expect(reopened.filePath).toBe('/path/to/closed.md');
      expect(reopened.title).toBe('closed.md');
    });

    it('should return message when no closed tabs available', async () => {
      // No closed tabs added

      const result = await server.callTool('tabs_reopen_closed', {});

      expect(result.success).toBe(true);
      expect(result.content[0].text).toBe('No closed tabs to reopen');
    });

    it('should send correct bridge request with windowId', async () => {
      await server.callTool('tabs_reopen_closed', { windowId: 'editor' });

      const requests = bridge.getRequestsOfType('tabs.reopenClosed');
      expect(requests).toHaveLength(1);
      expect(requests[0].request.windowId).toBe('editor');
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('Failed to reopen'));

      const result = await server.callTool('tabs_reopen_closed', {});

      expect(result.success).toBe(false);
      expect(result.content[0].text).toContain('Failed to reopen');
    });
  });
});
