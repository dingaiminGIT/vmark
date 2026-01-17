/**
 * McpTestClient - Utility for testing MCP server interactions.
 * Simulates MCP protocol without needing a real MCP SDK client.
 */

import type {
  ToolDefinition,
  ToolHandler,
  ResourceDefinition,
  ResourceHandler,
  ToolCallResult,
  ResourceReadResult,
  McpServerInterface,
} from '../../src/types.js';

// Re-export types for convenience
export type {
  ToolDefinition,
  ToolHandler,
  ResourceDefinition,
  ResourceHandler,
  ToolCallResult,
  ResourceReadResult,
  McpServerInterface,
};

/**
 * Alias for backwards compatibility.
 */
export type McpServerForTest = McpServerInterface;

/**
 * McpTestClient - Helper for testing MCP tools and resources.
 */
export class McpTestClient {
  private server: McpServerInterface;
  private toolCallHistory: Array<{ name: string; args: Record<string, unknown>; result: ToolCallResult }> = [];
  private resourceReadHistory: Array<{ uri: string; result: ResourceReadResult }> = [];

  constructor(server: McpServerInterface) {
    this.server = server;
  }

  /**
   * List all available tools.
   */
  listTools(): ToolDefinition[] {
    return this.server.listTools();
  }

  /**
   * List all available resources.
   */
  listResources(): ResourceDefinition[] {
    return this.server.listResources();
  }

  /**
   * Get a tool definition by name.
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.server.tools.get(name)?.definition;
  }

  /**
   * Get a resource definition by URI.
   */
  getResource(uri: string): ResourceDefinition | undefined {
    return this.server.resources.get(uri)?.definition;
  }

  /**
   * Call a tool with arguments.
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> {
    const result = await this.server.callTool(name, args);
    this.toolCallHistory.push({ name, args, result });
    return result;
  }

  /**
   * Read a resource by URI.
   */
  async readResource(uri: string): Promise<ResourceReadResult> {
    const result = await this.server.readResource(uri);
    this.resourceReadHistory.push({ uri, result });
    return result;
  }

  /**
   * Get tool call history.
   */
  getToolCallHistory() {
    return [...this.toolCallHistory];
  }

  /**
   * Get resource read history.
   */
  getResourceReadHistory() {
    return [...this.resourceReadHistory];
  }

  /**
   * Clear history.
   */
  clearHistory(): void {
    this.toolCallHistory = [];
    this.resourceReadHistory = [];
  }

  /**
   * Assert that a tool was called with specific arguments.
   */
  assertToolCalled(name: string, expectedArgs?: Record<string, unknown>): void {
    const calls = this.toolCallHistory.filter(c => c.name === name);
    if (calls.length === 0) {
      throw new Error(`Expected tool "${name}" to be called, but it was not`);
    }
    if (expectedArgs) {
      const matchingCall = calls.find(c =>
        Object.entries(expectedArgs).every(([key, value]) => c.args[key] === value)
      );
      if (!matchingCall) {
        throw new Error(
          `Expected tool "${name}" to be called with ${JSON.stringify(expectedArgs)}, ` +
          `but calls were: ${JSON.stringify(calls.map(c => c.args))}`
        );
      }
    }
  }

  /**
   * Assert that a resource was read.
   */
  assertResourceRead(uri: string): void {
    const reads = this.resourceReadHistory.filter(r => r.uri === uri);
    if (reads.length === 0) {
      throw new Error(`Expected resource "${uri}" to be read, but it was not`);
    }
  }

  /**
   * Get the text content from a tool result.
   */
  static getTextContent(result: ToolCallResult): string {
    const textContent = result.content.find(c => c.type === 'text');
    return textContent?.text ?? '';
  }

  /**
   * Get the JSON content from a tool result.
   */
  static getJsonContent<T = unknown>(result: ToolCallResult): T {
    const text = McpTestClient.getTextContent(result);
    return JSON.parse(text) as T;
  }

  /**
   * Get the text content from a resource read result.
   */
  static getResourceText(result: ResourceReadResult, uri?: string): string {
    const content = uri
      ? result.contents.find(c => c.uri === uri)
      : result.contents[0];
    return content?.text ?? '';
  }

  /**
   * Get the JSON content from a resource read result.
   */
  static getResourceJson<T = unknown>(result: ResourceReadResult, uri?: string): T {
    const text = McpTestClient.getResourceText(result, uri);
    return JSON.parse(text) as T;
  }
}

/**
 * Create a mock MCP server for testing.
 * This is a simple implementation that can be used to test the McpTestClient itself.
 */
export function createMockMcpServer(): McpServerInterface {
  const tools = new Map<string, { definition: ToolDefinition; handler: ToolHandler }>();
  const resources = new Map<string, { definition: ResourceDefinition; handler: ResourceHandler }>();

  return {
    tools,
    resources,

    listTools() {
      return Array.from(tools.values()).map(t => t.definition);
    },

    listResources() {
      return Array.from(resources.values()).map(r => r.definition);
    },

    async callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
      const tool = tools.get(name);
      if (!tool) {
        return {
          success: false,
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
      }
      return tool.handler(args);
    },

    async readResource(uri: string): Promise<ResourceReadResult> {
      const resource = resources.get(uri);
      if (!resource) {
        throw new Error(`Unknown resource: ${uri}`);
      }
      return resource.handler(uri);
    },
  };
}

/**
 * Helper to register a tool on a mock server.
 */
export function registerMockTool(
  server: McpServerInterface,
  definition: ToolDefinition,
  handler: ToolHandler
): void {
  server.tools.set(definition.name, { definition, handler });
}

/**
 * Helper to register a resource on a mock server.
 */
export function registerMockResource(
  server: McpServerInterface,
  definition: ResourceDefinition,
  handler: ResourceHandler
): void {
  server.resources.set(definition.uri, { definition, handler });
}
