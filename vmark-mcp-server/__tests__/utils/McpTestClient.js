/**
 * McpTestClient - Utility for testing MCP server interactions.
 * Simulates MCP protocol without needing a real MCP SDK client.
 */
/**
 * McpTestClient - Helper for testing MCP tools and resources.
 */
export class McpTestClient {
    server;
    toolCallHistory = [];
    resourceReadHistory = [];
    constructor(server) {
        this.server = server;
    }
    /**
     * List all available tools.
     */
    listTools() {
        return this.server.listTools();
    }
    /**
     * List all available resources.
     */
    listResources() {
        return this.server.listResources();
    }
    /**
     * Get a tool definition by name.
     */
    getTool(name) {
        return this.server.tools.get(name)?.definition;
    }
    /**
     * Get a resource definition by URI.
     */
    getResource(uri) {
        return this.server.resources.get(uri)?.definition;
    }
    /**
     * Call a tool with arguments.
     */
    async callTool(name, args = {}) {
        const result = await this.server.callTool(name, args);
        this.toolCallHistory.push({ name, args, result });
        return result;
    }
    /**
     * Read a resource by URI.
     */
    async readResource(uri) {
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
    clearHistory() {
        this.toolCallHistory = [];
        this.resourceReadHistory = [];
    }
    /**
     * Assert that a tool was called with specific arguments.
     */
    assertToolCalled(name, expectedArgs) {
        const calls = this.toolCallHistory.filter(c => c.name === name);
        if (calls.length === 0) {
            throw new Error(`Expected tool "${name}" to be called, but it was not`);
        }
        if (expectedArgs) {
            const matchingCall = calls.find(c => Object.entries(expectedArgs).every(([key, value]) => c.args[key] === value));
            if (!matchingCall) {
                throw new Error(`Expected tool "${name}" to be called with ${JSON.stringify(expectedArgs)}, ` +
                    `but calls were: ${JSON.stringify(calls.map(c => c.args))}`);
            }
        }
    }
    /**
     * Assert that a resource was read.
     */
    assertResourceRead(uri) {
        const reads = this.resourceReadHistory.filter(r => r.uri === uri);
        if (reads.length === 0) {
            throw new Error(`Expected resource "${uri}" to be read, but it was not`);
        }
    }
    /**
     * Get the text content from a tool result.
     */
    static getTextContent(result) {
        const textContent = result.content.find(c => c.type === 'text');
        return textContent?.text ?? '';
    }
    /**
     * Get the JSON content from a tool result.
     */
    static getJsonContent(result) {
        const text = McpTestClient.getTextContent(result);
        return JSON.parse(text);
    }
    /**
     * Get the text content from a resource read result.
     */
    static getResourceText(result, uri) {
        const content = uri
            ? result.contents.find(c => c.uri === uri)
            : result.contents[0];
        return content?.text ?? '';
    }
    /**
     * Get the JSON content from a resource read result.
     */
    static getResourceJson(result, uri) {
        const text = McpTestClient.getResourceText(result, uri);
        return JSON.parse(text);
    }
}
/**
 * Create a mock MCP server for testing.
 * This is a simple implementation that can be used to test the McpTestClient itself.
 */
export function createMockMcpServer() {
    const tools = new Map();
    const resources = new Map();
    return {
        tools,
        resources,
        listTools() {
            return Array.from(tools.values()).map(t => t.definition);
        },
        listResources() {
            return Array.from(resources.values()).map(r => r.definition);
        },
        async callTool(name, args) {
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
        async readResource(uri) {
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
export function registerMockTool(server, definition, handler) {
    server.tools.set(definition.name, { definition, handler });
}
/**
 * Helper to register a resource on a mock server.
 */
export function registerMockResource(server, definition, handler) {
    server.resources.set(definition.uri, { definition, handler });
}
//# sourceMappingURL=McpTestClient.js.map