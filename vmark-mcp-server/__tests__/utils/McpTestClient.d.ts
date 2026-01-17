/**
 * McpTestClient - Utility for testing MCP server interactions.
 * Simulates MCP protocol without needing a real MCP SDK client.
 */
/**
 * Tool definition as exposed by MCP server.
 */
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
}
/**
 * Resource definition as exposed by MCP server.
 */
export interface ResourceDefinition {
    uri: string;
    name: string;
    description: string;
    mimeType?: string;
}
/**
 * Tool call result.
 */
export interface ToolCallResult {
    success: boolean;
    content: Array<{
        type: 'text' | 'image' | 'resource';
        text?: string;
        data?: string;
        mimeType?: string;
    }>;
    isError?: boolean;
}
/**
 * Resource read result.
 */
export interface ResourceReadResult {
    contents: Array<{
        uri: string;
        text?: string;
        blob?: string;
        mimeType?: string;
    }>;
}
/**
 * Handler function for a tool.
 */
export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolCallResult>;
/**
 * Handler function for a resource.
 */
export type ResourceHandler = (uri: string) => Promise<ResourceReadResult>;
/**
 * MCP server interface for testing.
 */
export interface McpServerForTest {
    tools: Map<string, {
        definition: ToolDefinition;
        handler: ToolHandler;
    }>;
    resources: Map<string, {
        definition: ResourceDefinition;
        handler: ResourceHandler;
    }>;
    listTools(): ToolDefinition[];
    listResources(): ResourceDefinition[];
    callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult>;
    readResource(uri: string): Promise<ResourceReadResult>;
}
/**
 * McpTestClient - Helper for testing MCP tools and resources.
 */
export declare class McpTestClient {
    private server;
    private toolCallHistory;
    private resourceReadHistory;
    constructor(server: McpServerForTest);
    /**
     * List all available tools.
     */
    listTools(): ToolDefinition[];
    /**
     * List all available resources.
     */
    listResources(): ResourceDefinition[];
    /**
     * Get a tool definition by name.
     */
    getTool(name: string): ToolDefinition | undefined;
    /**
     * Get a resource definition by URI.
     */
    getResource(uri: string): ResourceDefinition | undefined;
    /**
     * Call a tool with arguments.
     */
    callTool(name: string, args?: Record<string, unknown>): Promise<ToolCallResult>;
    /**
     * Read a resource by URI.
     */
    readResource(uri: string): Promise<ResourceReadResult>;
    /**
     * Get tool call history.
     */
    getToolCallHistory(): {
        name: string;
        args: Record<string, unknown>;
        result: ToolCallResult;
    }[];
    /**
     * Get resource read history.
     */
    getResourceReadHistory(): {
        uri: string;
        result: ResourceReadResult;
    }[];
    /**
     * Clear history.
     */
    clearHistory(): void;
    /**
     * Assert that a tool was called with specific arguments.
     */
    assertToolCalled(name: string, expectedArgs?: Record<string, unknown>): void;
    /**
     * Assert that a resource was read.
     */
    assertResourceRead(uri: string): void;
    /**
     * Get the text content from a tool result.
     */
    static getTextContent(result: ToolCallResult): string;
    /**
     * Get the JSON content from a tool result.
     */
    static getJsonContent<T = unknown>(result: ToolCallResult): T;
    /**
     * Get the text content from a resource read result.
     */
    static getResourceText(result: ResourceReadResult, uri?: string): string;
    /**
     * Get the JSON content from a resource read result.
     */
    static getResourceJson<T = unknown>(result: ResourceReadResult, uri?: string): T;
}
/**
 * Create a mock MCP server for testing.
 * This is a simple implementation that can be used to test the McpTestClient itself.
 */
export declare function createMockMcpServer(): McpServerForTest;
/**
 * Helper to register a tool on a mock server.
 */
export declare function registerMockTool(server: McpServerForTest, definition: ToolDefinition, handler: ToolHandler): void;
/**
 * Helper to register a resource on a mock server.
 */
export declare function registerMockResource(server: McpServerForTest, definition: ResourceDefinition, handler: ResourceHandler): void;
//# sourceMappingURL=McpTestClient.d.ts.map