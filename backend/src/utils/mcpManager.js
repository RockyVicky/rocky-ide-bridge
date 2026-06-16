const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const config = require('./mcpConfig');

class MCPManager {
  constructor() {
    this.clients = new Map();
  }

  async init() {
    console.log('[MCP] Initializing Model Context Protocol...');
    for (const [name, serverConfig] of Object.entries(config.servers)) {
      try {
        console.log(`[MCP] Connecting to server: ${name}...`);
        const transport = new StdioClientTransport({
          command: serverConfig.command,
          args: serverConfig.args
        });

        const client = new Client(
          { name: "Rocky-HQ-Backend", version: "1.0.0" },
          { capabilities: {} }
        );

        await client.connect(transport);
        this.clients.set(name, client);
        console.log(`[MCP] Server '${name}' connected successfully.`);
      } catch (err) {
        console.error(`[MCP] Failed to connect to server '${name}':`, err);
      }
    }
  }

  async callTool(serverName, toolName, args = {}) {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP Server '${serverName}' not found or not connected.`);
    }

    try {
      return await client.callTool({
        name: toolName,
        arguments: args
      });
    } catch (err) {
      console.error(`[MCP] Error calling tool '${toolName}' on server '${serverName}':`, err);
      throw err;
    }
  }

  async listTools(serverName) {
    const client = this.clients.get(serverName);
    if (!client) return [];
    const result = await client.listTools();
    return result.tools || [];
  }
}

module.exports = new MCPManager();
