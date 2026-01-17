/**
 * Tests for selection tools.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VMarkMcpServer } from '../../../src/server.js';
import { registerSelectionTools } from '../../../src/tools/selection.js';
import { MockBridge } from '../../mocks/mockBridge.js';
import { McpTestClient } from '../../utils/McpTestClient.js';

describe('selection tools', () => {
  let bridge: MockBridge;
  let server: VMarkMcpServer;
  let client: McpTestClient;

  beforeEach(() => {
    bridge = new MockBridge();
    server = new VMarkMcpServer({ bridge });
    registerSelectionTools(server);
    client = new McpTestClient(server);
  });

  describe('selection_get', () => {
    it('should be registered as a tool', () => {
      const tool = client.getTool('selection_get');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('current text selection');
    });

    it('should return empty selection initially', async () => {
      const result = await client.callTool('selection_get');

      expect(result.success).toBe(true);
      const data = McpTestClient.getJsonContent<{
        text: string;
        isEmpty: boolean;
      }>(result);
      expect(data.text).toBe('');
      expect(data.isEmpty).toBe(true);
    });

    it('should return selected text', async () => {
      bridge.setContent('Hello world');
      bridge.setSelection(0, 5);

      const result = await client.callTool('selection_get');

      const data = McpTestClient.getJsonContent<{
        text: string;
        range: { from: number; to: number };
        isEmpty: boolean;
      }>(result);
      expect(data.text).toBe('Hello');
      expect(data.range).toEqual({ from: 0, to: 5 });
      expect(data.isEmpty).toBe(false);
    });

    it('should return cursor position when no selection', async () => {
      bridge.setContent('Hello');
      bridge.setCursorPosition(3);

      const result = await client.callTool('selection_get');

      const data = McpTestClient.getJsonContent<{
        range: { from: number; to: number };
        isEmpty: boolean;
      }>(result);
      expect(data.range).toEqual({ from: 3, to: 3 });
      expect(data.isEmpty).toBe(true);
    });

    it('should use specified windowId', async () => {
      bridge.addWindow('other');
      bridge.setContent('Other doc', 'other');
      bridge.setSelection(0, 5, 'other');

      const result = await client.callTool('selection_get', {
        windowId: 'other',
      });

      const data = McpTestClient.getJsonContent<{ text: string }>(result);
      expect(data.text).toBe('Other');
    });

    it('should handle bridge errors', async () => {
      bridge.setNextError(new Error('Bridge disconnected'));

      const result = await client.callTool('selection_get');

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('Failed to get selection');
    });
  });

  describe('selection_set', () => {
    it('should be registered as a tool', () => {
      const tool = client.getTool('selection_set');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toContain('from');
      expect(tool?.inputSchema.required).toContain('to');
    });

    it('should set selection range', async () => {
      bridge.setContent('Hello world');

      const result = await client.callTool('selection_set', {
        from: 6,
        to: 11,
      });

      expect(result.success).toBe(true);
      const state = bridge.getWindowState();
      expect(state?.selection.text).toBe('world');
    });

    it('should set cursor when from equals to', async () => {
      bridge.setContent('Hello');

      const result = await client.callTool('selection_set', {
        from: 3,
        to: 3,
      });

      expect(result.success).toBe(true);
      expect(McpTestClient.getTextContent(result)).toContain('Cursor positioned at 3');
      expect(bridge.getWindowState()?.cursorPosition).toBe(3);
    });

    it('should report selection length', async () => {
      bridge.setContent('Hello world');

      const result = await client.callTool('selection_set', {
        from: 0,
        to: 5,
      });

      expect(McpTestClient.getTextContent(result)).toContain('5 characters');
    });

    it('should reject negative from', async () => {
      const result = await client.callTool('selection_set', {
        from: -1,
        to: 5,
      });

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('non-negative');
    });

    it('should reject negative to', async () => {
      const result = await client.callTool('selection_set', {
        from: 0,
        to: -1,
      });

      expect(result.success).toBe(false);
    });

    it('should reject from greater than to', async () => {
      const result = await client.callTool('selection_set', {
        from: 10,
        to: 5,
      });

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('from cannot be greater than to');
    });

    it('should use specified windowId', async () => {
      bridge.addWindow('other');
      bridge.setContent('Other content', 'other');

      await client.callTool('selection_set', {
        from: 0,
        to: 5,
        windowId: 'other',
      });

      expect(bridge.getWindowState('other')?.selection.text).toBe('Other');
      expect(bridge.getWindowState('main')?.selection.text).toBe('');
    });
  });

  describe('selection_replace', () => {
    it('should be registered as a tool', () => {
      const tool = client.getTool('selection_replace');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toContain('text');
    });

    it('should replace selected text', async () => {
      bridge.setContent('Hello world');
      bridge.setSelection(6, 11);

      const result = await client.callTool('selection_replace', {
        text: 'universe',
      });

      expect(result.success).toBe(true);
      expect(bridge.getWindowState()?.content).toBe('Hello universe');
    });

    it('should insert at cursor when no selection', async () => {
      bridge.setContent('Hello');
      bridge.setCursorPosition(5);

      await client.callTool('selection_replace', {
        text: ' world',
      });

      expect(bridge.getWindowState()?.content).toBe('Hello world');
    });

    it('should report number of characters', async () => {
      bridge.setContent('test');
      bridge.setSelection(0, 4);

      const result = await client.callTool('selection_replace', {
        text: 'replacement',
      });

      expect(McpTestClient.getTextContent(result)).toContain('11 characters');
    });

    it('should handle empty replacement (delete)', async () => {
      bridge.setContent('Hello cruel world');
      bridge.setSelection(5, 11);

      const result = await client.callTool('selection_replace', {
        text: '',
      });

      expect(result.success).toBe(true);
      expect(bridge.getWindowState()?.content).toBe('Hello world');
    });

    it('should require text parameter', async () => {
      bridge.setSelection(0, 1);

      const result = await client.callTool('selection_replace', {});

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('text must be a string');
    });

    it('should handle multiline replacement', async () => {
      bridge.setContent('one\ntwo\nthree');
      bridge.setSelection(0, 7); // "one\ntwo"

      await client.callTool('selection_replace', {
        text: '1\n2',
      });

      expect(bridge.getWindowState()?.content).toBe('1\n2\nthree');
    });

    it('should use specified windowId', async () => {
      bridge.addWindow('other');
      bridge.setContent('foo', 'other');
      bridge.setSelection(0, 3, 'other');

      await client.callTool('selection_replace', {
        text: 'bar',
        windowId: 'other',
      });

      expect(bridge.getWindowState('other')?.content).toBe('bar');
    });
  });

  describe('selection_delete', () => {
    it('should be registered as a tool', () => {
      const tool = client.getTool('selection_delete');
      expect(tool).toBeDefined();
    });

    it('should delete selected text', async () => {
      bridge.setContent('Hello world');
      bridge.setSelection(5, 11);

      const result = await client.callTool('selection_delete');

      expect(result.success).toBe(true);
      expect(bridge.getWindowState()?.content).toBe('Hello');
    });

    it('should be no-op with no selection', async () => {
      bridge.setContent('Hello');
      bridge.setCursorPosition(3);

      const result = await client.callTool('selection_delete');

      expect(result.success).toBe(true);
      expect(bridge.getWindowState()?.content).toBe('Hello');
    });

    it('should position cursor at start of deleted range', async () => {
      bridge.setContent('Hello world');
      bridge.setSelection(6, 11);

      await client.callTool('selection_delete');

      expect(bridge.getWindowState()?.cursorPosition).toBe(6);
    });

    it('should handle delete at start', async () => {
      bridge.setContent('Hello world');
      bridge.setSelection(0, 6);

      await client.callTool('selection_delete');

      expect(bridge.getWindowState()?.content).toBe('world');
    });

    it('should use specified windowId', async () => {
      bridge.addWindow('other');
      bridge.setContent('delete me', 'other');
      bridge.setSelection(0, 9, 'other');

      await client.callTool('selection_delete', { windowId: 'other' });

      expect(bridge.getWindowState('other')?.content).toBe('');
      expect(bridge.getWindowState('main')?.content).toBe('');
    });
  });

  describe('cursor_get_context', () => {
    it('should be registered as a tool', () => {
      const tool = client.getTool('cursor_get_context');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('surrounding the cursor');
    });

    it('should return context around cursor', async () => {
      bridge.setContent('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
      bridge.setCursorPosition(14); // In "Line 3"

      const result = await client.callTool('cursor_get_context');

      const data = McpTestClient.getJsonContent<{
        currentLine: string;
        before: string;
        after: string;
      }>(result);

      expect(data.currentLine).toBe('Line 3');
      expect(data.before).toContain('Line 1');
      expect(data.after).toContain('Line 4');
    });

    it('should respect linesBefore parameter', async () => {
      bridge.setContent('1\n2\n3\n4\n5');
      bridge.setCursorPosition(6); // In "4"

      const result = await client.callTool('cursor_get_context', {
        linesBefore: 1,
        linesAfter: 1,
      });

      const data = McpTestClient.getJsonContent<{
        before: string;
        after: string;
      }>(result);

      expect(data.before).toBe('3');
      expect(data.after).toBe('5');
    });

    it('should return current paragraph', async () => {
      bridge.setContent('First paragraph.\n\nSecond paragraph\nstill second.\n\nThird.');
      bridge.setCursorPosition(20); // In "Second paragraph"

      const result = await client.callTool('cursor_get_context');

      const data = McpTestClient.getJsonContent<{ currentParagraph: string }>(result);

      expect(data.currentParagraph).toContain('Second paragraph');
      expect(data.currentParagraph).toContain('still second');
    });

    it('should use default linesBefore and linesAfter', async () => {
      bridge.setContent('test');

      await client.callTool('cursor_get_context');

      const request = bridge.getRequestsOfType('cursor.getContext')[0];
      const req = request.request as { linesBefore?: number; linesAfter?: number };
      expect(req.linesBefore).toBe(3);
      expect(req.linesAfter).toBe(3);
    });

    it('should reject negative linesBefore', async () => {
      const result = await client.callTool('cursor_get_context', {
        linesBefore: -1,
      });

      expect(result.success).toBe(false);
    });

    it('should reject negative linesAfter', async () => {
      const result = await client.callTool('cursor_get_context', {
        linesAfter: -1,
      });

      expect(result.success).toBe(false);
    });

    it('should handle cursor at start', async () => {
      bridge.setContent('First line\nSecond line');
      bridge.setCursorPosition(0);

      const result = await client.callTool('cursor_get_context');

      expect(result.success).toBe(true);
      const data = McpTestClient.getJsonContent<{ currentLine: string }>(result);
      expect(data.currentLine).toBe('First line');
    });

    it('should use specified windowId', async () => {
      bridge.addWindow('other');
      bridge.setContent('Other\nContent', 'other');
      bridge.setCursorPosition(0, 'other');

      const result = await client.callTool('cursor_get_context', {
        windowId: 'other',
      });

      const data = McpTestClient.getJsonContent<{ currentLine: string }>(result);
      expect(data.currentLine).toBe('Other');
    });
  });

  describe('cursor_set_position', () => {
    it('should be registered as a tool', () => {
      const tool = client.getTool('cursor_set_position');
      expect(tool).toBeDefined();
      expect(tool?.inputSchema.required).toContain('position');
    });

    it('should set cursor position', async () => {
      bridge.setContent('Hello world');

      const result = await client.callTool('cursor_set_position', {
        position: 6,
      });

      expect(result.success).toBe(true);
      expect(bridge.getWindowState()?.cursorPosition).toBe(6);
    });

    it('should clear selection', async () => {
      bridge.setContent('Hello world');
      bridge.setSelection(0, 5);

      await client.callTool('cursor_set_position', {
        position: 6,
      });

      expect(bridge.getWindowState()?.selection.isEmpty).toBe(true);
    });

    it('should report position in success message', async () => {
      const result = await client.callTool('cursor_set_position', {
        position: 10,
      });

      expect(McpTestClient.getTextContent(result)).toContain('positioned at 10');
    });

    it('should require position parameter', async () => {
      const result = await client.callTool('cursor_set_position', {});

      expect(result.success).toBe(false);
    });

    it('should reject negative position', async () => {
      const result = await client.callTool('cursor_set_position', {
        position: -5,
      });

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('non-negative');
    });

    it('should handle position at start', async () => {
      bridge.setContent('Hello');
      bridge.setCursorPosition(5);

      await client.callTool('cursor_set_position', {
        position: 0,
      });

      expect(bridge.getWindowState()?.cursorPosition).toBe(0);
    });

    it('should use specified windowId', async () => {
      bridge.addWindow('other');
      bridge.setContent('test', 'other');

      await client.callTool('cursor_set_position', {
        position: 2,
        windowId: 'other',
      });

      expect(bridge.getWindowState('other')?.cursorPosition).toBe(2);
      expect(bridge.getWindowState('main')?.cursorPosition).toBe(0);
    });
  });

  describe('tool interaction', () => {
    it('should allow get -> modify -> get workflow', async () => {
      bridge.setContent('Hello world');
      bridge.setSelection(0, 5);

      // Get current selection
      const before = await client.callTool('selection_get');
      expect(McpTestClient.getJsonContent<{ text: string }>(before).text).toBe('Hello');

      // Replace selection
      await client.callTool('selection_replace', { text: 'Hi' });

      // Verify content changed
      expect(bridge.getWindowState()?.content).toBe('Hi world');
    });

    it('should allow set selection -> get context workflow', async () => {
      bridge.setContent('Line 1\nLine 2\nLine 3');

      // Set cursor position
      await client.callTool('cursor_set_position', { position: 7 });

      // Get context
      const context = await client.callTool('cursor_get_context');
      const data = McpTestClient.getJsonContent<{ currentLine: string }>(context);

      expect(data.currentLine).toBe('Line 2');
    });
  });
});
