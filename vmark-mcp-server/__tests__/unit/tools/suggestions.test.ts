/**
 * Tests for suggestion tools.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VMarkMcpServer } from '../../../src/server.js';
import { registerSuggestionTools } from '../../../src/tools/suggestions.js';
import { MockBridge } from '../../mocks/mockBridge.js';
import { McpTestClient } from '../../utils/McpTestClient.js';
import type { Suggestion } from '../../../src/bridge/types.js';

describe('suggestion tools', () => {
  let bridge: MockBridge;
  let server: VMarkMcpServer;
  let client: McpTestClient;

  // Helper to create a suggestion
  const createSuggestion = (
    id: string,
    type: 'insert' | 'replace' | 'delete' = 'insert',
    overrides: Partial<Suggestion> = {}
  ): Suggestion => ({
    id,
    type,
    from: 0,
    to: 0,
    newContent: type === 'delete' ? undefined : 'test content',
    createdAt: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    bridge = new MockBridge();
    server = new VMarkMcpServer({ bridge });
    registerSuggestionTools(server);
    client = new McpTestClient(server);
  });

  describe('suggestion_list', () => {
    it('should be registered as a tool', () => {
      const tool = client.getTool('suggestion_list');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('pending AI suggestions');
    });

    it('should have optional windowId parameter', () => {
      const tool = client.getTool('suggestion_list');
      expect(tool?.inputSchema.required).toBeUndefined();
    });

    it('should return empty message when no suggestions', async () => {
      const result = await client.callTool('suggestion_list');

      expect(result.success).toBe(true);
      expect(McpTestClient.getTextContent(result)).toBe('No pending suggestions');
    });

    it('should list all pending suggestions', async () => {
      bridge.addSuggestion(createSuggestion('sugg-1', 'insert'));
      bridge.addSuggestion(createSuggestion('sugg-2', 'replace'));

      const result = await client.callTool('suggestion_list');

      expect(result.success).toBe(true);
      const text = McpTestClient.getTextContent(result);
      expect(text).toContain('Found 2 pending suggestion(s)');
      expect(text).toContain('sugg-1');
      expect(text).toContain('sugg-2');
    });

    it('should return suggestion details in JSON format', async () => {
      bridge.addSuggestion(
        createSuggestion('sugg-1', 'replace', {
          from: 10,
          to: 20,
          newContent: 'new text',
          originalContent: 'old text',
        })
      );

      const result = await client.callTool('suggestion_list');

      expect(result.success).toBe(true);
      const text = McpTestClient.getTextContent(result);
      expect(text).toContain('"id": "sugg-1"');
      expect(text).toContain('"type": "replace"');
      expect(text).toContain('"from": 10');
      expect(text).toContain('"to": 20');
      expect(text).toContain('"newContent": "new text"');
    });

    it('should use focused window by default', async () => {
      await client.callTool('suggestion_list');

      const requests = bridge.getRequestsOfType('suggestion.list');
      expect(requests).toHaveLength(1);
      expect((requests[0].request as { windowId?: string }).windowId).toBe('focused');
    });

    it('should use specified windowId', async () => {
      bridge.addWindow('other');
      bridge.addSuggestion(createSuggestion('other-sugg'), 'other');

      const result = await client.callTool('suggestion_list', { windowId: 'other' });

      expect(result.success).toBe(true);
      expect(McpTestClient.getTextContent(result)).toContain('other-sugg');
    });

    it('should handle bridge errors', async () => {
      bridge.setResponseHandler('suggestion.list', () => ({
        success: false,
        error: 'Connection lost',
        data: null,
      }));

      const result = await client.callTool('suggestion_list');

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('Failed to list suggestions');
    });

    it('should handle thrown errors', async () => {
      bridge.setNextError(new Error('Network error'));

      const result = await client.callTool('suggestion_list');

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('Network error');
    });
  });

  describe('suggestion_accept', () => {
    it('should be registered as a tool', () => {
      const tool = client.getTool('suggestion_accept');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Accept a specific AI suggestion');
      expect(tool?.inputSchema.required).toContain('suggestionId');
    });

    it('should accept a suggestion by ID', async () => {
      bridge.addSuggestion(createSuggestion('sugg-to-accept'));

      const result = await client.callTool('suggestion_accept', {
        suggestionId: 'sugg-to-accept',
      });

      expect(result.success).toBe(true);
      expect(McpTestClient.getTextContent(result)).toContain('sugg-to-accept accepted and applied');
      // Verify suggestion was removed
      expect(bridge.getSuggestions()).toHaveLength(0);
    });

    it('should remove accepted suggestion from list', async () => {
      bridge.addSuggestion(createSuggestion('sugg-1'));
      bridge.addSuggestion(createSuggestion('sugg-2'));
      bridge.addSuggestion(createSuggestion('sugg-3'));

      await client.callTool('suggestion_accept', { suggestionId: 'sugg-2' });

      const remaining = bridge.getSuggestions();
      expect(remaining).toHaveLength(2);
      expect(remaining.map(s => s.id)).toEqual(['sugg-1', 'sugg-3']);
    });

    it('should fail for non-existent suggestion', async () => {
      const result = await client.callTool('suggestion_accept', {
        suggestionId: 'non-existent',
      });

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('Failed to accept suggestion');
    });

    it('should require suggestionId parameter', async () => {
      const result = await client.callTool('suggestion_accept', {});

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('suggestionId');
    });

    it('should use focused window by default', async () => {
      bridge.addSuggestion(createSuggestion('sugg-1'));

      await client.callTool('suggestion_accept', { suggestionId: 'sugg-1' });

      const requests = bridge.getRequestsOfType('suggestion.accept');
      expect(requests).toHaveLength(1);
      expect((requests[0].request as { windowId?: string }).windowId).toBe('focused');
    });

    it('should use specified windowId', async () => {
      bridge.addWindow('other');
      bridge.addSuggestion(createSuggestion('other-sugg'), 'other');

      await client.callTool('suggestion_accept', {
        suggestionId: 'other-sugg',
        windowId: 'other',
      });

      const requests = bridge.getRequestsOfType('suggestion.accept');
      expect((requests[0].request as { windowId?: string }).windowId).toBe('other');
    });

    it('should handle bridge errors', async () => {
      bridge.setResponseHandler('suggestion.accept', () => ({
        success: false,
        error: 'Suggestion expired',
        data: null,
      }));

      const result = await client.callTool('suggestion_accept', {
        suggestionId: 'sugg-1',
      });

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('Failed to accept suggestion');
    });
  });

  describe('suggestion_reject', () => {
    it('should be registered as a tool', () => {
      const tool = client.getTool('suggestion_reject');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Reject a specific AI suggestion');
      expect(tool?.inputSchema.required).toContain('suggestionId');
    });

    it('should reject a suggestion by ID', async () => {
      bridge.addSuggestion(createSuggestion('sugg-to-reject'));

      const result = await client.callTool('suggestion_reject', {
        suggestionId: 'sugg-to-reject',
      });

      expect(result.success).toBe(true);
      expect(McpTestClient.getTextContent(result)).toContain('sugg-to-reject rejected');
      expect(bridge.getSuggestions()).toHaveLength(0);
    });

    it('should remove rejected suggestion from list', async () => {
      bridge.addSuggestion(createSuggestion('sugg-1'));
      bridge.addSuggestion(createSuggestion('sugg-2'));

      await client.callTool('suggestion_reject', { suggestionId: 'sugg-1' });

      const remaining = bridge.getSuggestions();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('sugg-2');
    });

    it('should fail for non-existent suggestion', async () => {
      const result = await client.callTool('suggestion_reject', {
        suggestionId: 'non-existent',
      });

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('Failed to reject suggestion');
    });

    it('should require suggestionId parameter', async () => {
      const result = await client.callTool('suggestion_reject', {});

      expect(result.success).toBe(false);
    });

    it('should use specified windowId', async () => {
      bridge.addWindow('other');
      bridge.addSuggestion(createSuggestion('other-sugg'), 'other');

      await client.callTool('suggestion_reject', {
        suggestionId: 'other-sugg',
        windowId: 'other',
      });

      const requests = bridge.getRequestsOfType('suggestion.reject');
      expect((requests[0].request as { windowId?: string }).windowId).toBe('other');
    });

    it('should handle bridge errors', async () => {
      bridge.setResponseHandler('suggestion.reject', () => ({
        success: false,
        error: 'Suggestion not found',
        data: null,
      }));

      const result = await client.callTool('suggestion_reject', {
        suggestionId: 'sugg-1',
      });

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('Failed to reject suggestion');
    });
  });

  describe('suggestion_accept_all', () => {
    it('should be registered as a tool', () => {
      const tool = client.getTool('suggestion_accept_all');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Accept all pending AI suggestions');
    });

    it('should have optional windowId parameter', () => {
      const tool = client.getTool('suggestion_accept_all');
      expect(tool?.inputSchema.required).toBeUndefined();
    });

    it('should accept all suggestions', async () => {
      bridge.addSuggestion(createSuggestion('sugg-1'));
      bridge.addSuggestion(createSuggestion('sugg-2'));
      bridge.addSuggestion(createSuggestion('sugg-3'));

      const result = await client.callTool('suggestion_accept_all');

      expect(result.success).toBe(true);
      expect(McpTestClient.getTextContent(result)).toContain('Accepted 3 suggestion(s)');
      expect(bridge.getSuggestions()).toHaveLength(0);
    });

    it('should report zero when no suggestions', async () => {
      const result = await client.callTool('suggestion_accept_all');

      expect(result.success).toBe(true);
      expect(McpTestClient.getTextContent(result)).toContain('Accepted 0 suggestion(s)');
    });

    it('should use focused window by default', async () => {
      await client.callTool('suggestion_accept_all');

      const requests = bridge.getRequestsOfType('suggestion.acceptAll');
      expect(requests).toHaveLength(1);
      expect((requests[0].request as { windowId?: string }).windowId).toBe('focused');
    });

    it('should use specified windowId', async () => {
      bridge.addWindow('other');
      bridge.addSuggestion(createSuggestion('other-sugg-1'), 'other');
      bridge.addSuggestion(createSuggestion('other-sugg-2'), 'other');

      const result = await client.callTool('suggestion_accept_all', {
        windowId: 'other',
      });

      expect(result.success).toBe(true);
      expect(McpTestClient.getTextContent(result)).toContain('Accepted 2 suggestion(s)');
    });

    it('should handle bridge errors', async () => {
      bridge.setResponseHandler('suggestion.acceptAll', () => ({
        success: false,
        error: 'Operation failed',
        data: null,
      }));

      const result = await client.callTool('suggestion_accept_all');

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('Failed to accept all suggestions');
    });

    it('should handle thrown errors', async () => {
      bridge.setNextError(new Error('Connection reset'));

      const result = await client.callTool('suggestion_accept_all');

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('Connection reset');
    });
  });

  describe('suggestion_reject_all', () => {
    it('should be registered as a tool', () => {
      const tool = client.getTool('suggestion_reject_all');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Reject all pending AI suggestions');
    });

    it('should have optional windowId parameter', () => {
      const tool = client.getTool('suggestion_reject_all');
      expect(tool?.inputSchema.required).toBeUndefined();
    });

    it('should reject all suggestions', async () => {
      bridge.addSuggestion(createSuggestion('sugg-1'));
      bridge.addSuggestion(createSuggestion('sugg-2'));

      const result = await client.callTool('suggestion_reject_all');

      expect(result.success).toBe(true);
      expect(McpTestClient.getTextContent(result)).toContain('Rejected 2 suggestion(s)');
      expect(bridge.getSuggestions()).toHaveLength(0);
    });

    it('should report zero when no suggestions', async () => {
      const result = await client.callTool('suggestion_reject_all');

      expect(result.success).toBe(true);
      expect(McpTestClient.getTextContent(result)).toContain('Rejected 0 suggestion(s)');
    });

    it('should use focused window by default', async () => {
      await client.callTool('suggestion_reject_all');

      const requests = bridge.getRequestsOfType('suggestion.rejectAll');
      expect(requests).toHaveLength(1);
      expect((requests[0].request as { windowId?: string }).windowId).toBe('focused');
    });

    it('should use specified windowId', async () => {
      bridge.addWindow('other');
      bridge.addSuggestion(createSuggestion('other-sugg'), 'other');

      const result = await client.callTool('suggestion_reject_all', {
        windowId: 'other',
      });

      expect(result.success).toBe(true);
      expect(bridge.getSuggestions('other')).toHaveLength(0);
    });

    it('should handle bridge errors', async () => {
      bridge.setResponseHandler('suggestion.rejectAll', () => ({
        success: false,
        error: 'Permission denied',
        data: null,
      }));

      const result = await client.callTool('suggestion_reject_all');

      expect(result.success).toBe(false);
      expect(McpTestClient.getTextContent(result)).toContain('Failed to reject all suggestions');
    });
  });

  describe('tool combinations', () => {
    it('should allow listing after accepting', async () => {
      bridge.addSuggestion(createSuggestion('sugg-1'));
      bridge.addSuggestion(createSuggestion('sugg-2'));

      await client.callTool('suggestion_accept', { suggestionId: 'sugg-1' });
      const result = await client.callTool('suggestion_list');

      expect(result.success).toBe(true);
      const text = McpTestClient.getTextContent(result);
      expect(text).toContain('Found 1 pending suggestion(s)');
      expect(text).toContain('sugg-2');
      expect(text).not.toContain('sugg-1');
    });

    it('should allow listing after rejecting', async () => {
      bridge.addSuggestion(createSuggestion('sugg-1'));
      bridge.addSuggestion(createSuggestion('sugg-2'));

      await client.callTool('suggestion_reject', { suggestionId: 'sugg-2' });
      const result = await client.callTool('suggestion_list');

      expect(result.success).toBe(true);
      const text = McpTestClient.getTextContent(result);
      expect(text).toContain('Found 1 pending suggestion(s)');
      expect(text).toContain('sugg-1');
    });

    it('should track call history', async () => {
      bridge.addSuggestion(createSuggestion('sugg-1'));

      await client.callTool('suggestion_list');
      await client.callTool('suggestion_accept', { suggestionId: 'sugg-1' });
      await client.callTool('suggestion_list');

      const history = client.getToolCallHistory();
      expect(history).toHaveLength(3);
      expect(history.map(h => h.name)).toEqual([
        'suggestion_list',
        'suggestion_accept',
        'suggestion_list',
      ]);
    });

    it('should handle mixed accept/reject workflow', async () => {
      bridge.addSuggestion(createSuggestion('sugg-1'));
      bridge.addSuggestion(createSuggestion('sugg-2'));
      bridge.addSuggestion(createSuggestion('sugg-3'));

      // Accept first, reject second, leave third
      await client.callTool('suggestion_accept', { suggestionId: 'sugg-1' });
      await client.callTool('suggestion_reject', { suggestionId: 'sugg-2' });

      const remaining = bridge.getSuggestions();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('sugg-3');
    });

    it('should handle accept_all after partial operations', async () => {
      bridge.addSuggestion(createSuggestion('sugg-1'));
      bridge.addSuggestion(createSuggestion('sugg-2'));
      bridge.addSuggestion(createSuggestion('sugg-3'));

      // Reject one, then accept all remaining
      await client.callTool('suggestion_reject', { suggestionId: 'sugg-1' });
      const result = await client.callTool('suggestion_accept_all');

      expect(result.success).toBe(true);
      expect(McpTestClient.getTextContent(result)).toContain('Accepted 2 suggestion(s)');
      expect(bridge.getSuggestions()).toHaveLength(0);
    });
  });

  describe('multi-window scenarios', () => {
    it('should isolate suggestions per window', async () => {
      bridge.addWindow('window-a');
      bridge.addWindow('window-b');

      bridge.addSuggestion(createSuggestion('sugg-a1'), 'window-a');
      bridge.addSuggestion(createSuggestion('sugg-a2'), 'window-a');
      bridge.addSuggestion(createSuggestion('sugg-b1'), 'window-b');

      // Accept from window-a
      await client.callTool('suggestion_accept', {
        suggestionId: 'sugg-a1',
        windowId: 'window-a',
      });

      // Verify window-a has 1 suggestion left
      expect(bridge.getSuggestions('window-a')).toHaveLength(1);
      // Verify window-b is unaffected
      expect(bridge.getSuggestions('window-b')).toHaveLength(1);
    });

    it('should reject_all only in specified window', async () => {
      bridge.addWindow('window-a');
      bridge.addWindow('window-b');

      bridge.addSuggestion(createSuggestion('sugg-a1'), 'window-a');
      bridge.addSuggestion(createSuggestion('sugg-b1'), 'window-b');
      bridge.addSuggestion(createSuggestion('sugg-b2'), 'window-b');

      await client.callTool('suggestion_reject_all', { windowId: 'window-b' });

      expect(bridge.getSuggestions('window-a')).toHaveLength(1);
      expect(bridge.getSuggestions('window-b')).toHaveLength(0);
    });
  });

  describe('suggestion types', () => {
    it('should handle insert suggestion', async () => {
      bridge.addSuggestion(
        createSuggestion('insert-sugg', 'insert', {
          from: 10,
          to: 10, // Insert at position
          newContent: 'inserted text',
        })
      );

      const result = await client.callTool('suggestion_list');
      const text = McpTestClient.getTextContent(result);
      expect(text).toContain('"type": "insert"');
      expect(text).toContain('"newContent": "inserted text"');
    });

    it('should handle replace suggestion', async () => {
      bridge.addSuggestion(
        createSuggestion('replace-sugg', 'replace', {
          from: 0,
          to: 10,
          newContent: 'replacement',
          originalContent: 'original',
        })
      );

      const result = await client.callTool('suggestion_list');
      const text = McpTestClient.getTextContent(result);
      expect(text).toContain('"type": "replace"');
      expect(text).toContain('"originalContent": "original"');
    });

    it('should handle delete suggestion', async () => {
      bridge.addSuggestion(
        createSuggestion('delete-sugg', 'delete', {
          from: 5,
          to: 15,
          newContent: undefined,
          originalContent: 'to delete',
        })
      );

      const result = await client.callTool('suggestion_list');
      const text = McpTestClient.getTextContent(result);
      expect(text).toContain('"type": "delete"');
      expect(text).toContain('"originalContent": "to delete"');
    });
  });
});
