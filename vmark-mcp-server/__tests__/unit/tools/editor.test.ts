/**
 * Tests for editor tools.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VMarkMcpServer } from '../../../src/server.js';
import { registerEditorTools } from '../../../src/tools/editor.js';
import { MockBridge } from '../../mocks/mockBridge.js';
import { McpTestClient } from '../../utils/McpTestClient.js';

describe('editor tools', () => {
  let bridge: MockBridge;
  let server: VMarkMcpServer;
  let client: McpTestClient;

  beforeEach(() => {
    bridge = new MockBridge();
    server = new VMarkMcpServer({ bridge });
    registerEditorTools(server);
    client = new McpTestClient(server);
  });

  describe('editor_undo', () => {
    it('should be registered as a tool', () => {
      const tool = client.getTool('editor_undo');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Undo');
    });

    it('should have optional windowId parameter', () => {
      const tool = client.getTool('editor_undo');
      expect(tool?.inputSchema.required).toBeUndefined();
    });

    it('should send undo request to bridge', async () => {
      const result = await client.callTool('editor_undo');

      expect(result.success).toBe(true);
      expect(McpTestClient.getTextContent(result)).toContain('Undo completed');

      const requests = bridge.getRequestsOfType('editor.undo');
      expect(requests).toHaveLength(1);
    });

    it('should use focused window by default', async () => {
      await client.callTool('editor_undo');

      const requests = bridge.getRequestsOfType('editor.undo');
      expect((requests[0].request as { windowId?: string }).windowId).toBe('focused');
    });

    it('should use specified windowId', async () => {
      bridge.addWindow('other');

      await client.callTool('editor_undo', { windowId: 'other' });

      const requests = bridge.getRequestsOfType('editor.undo');
      expect((requests[0].request as { windowId?: string }).windowId).toBe('other');
    });

    it('should handle bridge errors', async () => {
      bridge.setResponseHandler('editor.undo', () => ({
        success: false,
        error: 'Nothing to undo',
        data: null,
      }));

      const result = await client.callTool('editor_undo');

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('Failed to undo');
    });

    it('should handle thrown errors', async () => {
      bridge.setNextError(new Error('Connection lost'));

      const result = await client.callTool('editor_undo');

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('Connection lost');
    });
  });

  describe('editor_redo', () => {
    it('should be registered as a tool', () => {
      const tool = client.getTool('editor_redo');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Redo');
    });

    it('should have optional windowId parameter', () => {
      const tool = client.getTool('editor_redo');
      expect(tool?.inputSchema.required).toBeUndefined();
    });

    it('should send redo request to bridge', async () => {
      const result = await client.callTool('editor_redo');

      expect(result.success).toBe(true);
      expect(McpTestClient.getTextContent(result)).toContain('Redo completed');

      const requests = bridge.getRequestsOfType('editor.redo');
      expect(requests).toHaveLength(1);
    });

    it('should use focused window by default', async () => {
      await client.callTool('editor_redo');

      const requests = bridge.getRequestsOfType('editor.redo');
      expect((requests[0].request as { windowId?: string }).windowId).toBe('focused');
    });

    it('should use specified windowId', async () => {
      bridge.addWindow('other');

      await client.callTool('editor_redo', { windowId: 'other' });

      const requests = bridge.getRequestsOfType('editor.redo');
      expect((requests[0].request as { windowId?: string }).windowId).toBe('other');
    });

    it('should handle bridge errors', async () => {
      bridge.setResponseHandler('editor.redo', () => ({
        success: false,
        error: 'Nothing to redo',
        data: null,
      }));

      const result = await client.callTool('editor_redo');

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('Failed to redo');
    });
  });

  describe('editor_focus', () => {
    it('should be registered as a tool', () => {
      const tool = client.getTool('editor_focus');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Focus');
    });

    it('should have optional windowId parameter', () => {
      const tool = client.getTool('editor_focus');
      expect(tool?.inputSchema.required).toBeUndefined();
    });

    it('should send focus request to bridge', async () => {
      const result = await client.callTool('editor_focus');

      expect(result.success).toBe(true);
      expect(McpTestClient.getTextContent(result)).toContain('Editor focused');

      const requests = bridge.getRequestsOfType('editor.focus');
      expect(requests).toHaveLength(1);
    });

    it('should use focused window by default', async () => {
      await client.callTool('editor_focus');

      const requests = bridge.getRequestsOfType('editor.focus');
      expect((requests[0].request as { windowId?: string }).windowId).toBe('focused');
    });

    it('should use specified windowId', async () => {
      bridge.addWindow('other');

      await client.callTool('editor_focus', { windowId: 'other' });

      const requests = bridge.getRequestsOfType('editor.focus');
      expect((requests[0].request as { windowId?: string }).windowId).toBe('other');
    });

    it('should handle bridge errors', async () => {
      bridge.setResponseHandler('editor.focus', () => ({
        success: false,
        error: 'Window not found',
        data: null,
      }));

      const result = await client.callTool('editor_focus');

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('Failed to focus');
    });
  });

  describe('tool combinations', () => {
    it('should allow undo after redo', async () => {
      await client.callTool('editor_redo');
      await client.callTool('editor_undo');

      expect(bridge.getRequestsOfType('editor.redo')).toHaveLength(1);
      expect(bridge.getRequestsOfType('editor.undo')).toHaveLength(1);
    });

    it('should allow multiple undo calls', async () => {
      await client.callTool('editor_undo');
      await client.callTool('editor_undo');
      await client.callTool('editor_undo');

      expect(bridge.getRequestsOfType('editor.undo')).toHaveLength(3);
    });

    it('should track call history', async () => {
      await client.callTool('editor_undo');
      await client.callTool('editor_redo');
      await client.callTool('editor_focus');

      const history = client.getToolCallHistory();
      expect(history).toHaveLength(3);
      expect(history.map(h => h.name)).toEqual([
        'editor_undo',
        'editor_redo',
        'editor_focus',
      ]);
    });
  });
});
