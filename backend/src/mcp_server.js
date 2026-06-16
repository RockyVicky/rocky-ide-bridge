const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const fs = require('fs');
const path = require('path');

const server = new Server(
  {
    name: "Rocky-Telemetry-Hub",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "transmit_rocky_intel",
        description: "Transmit execution progress, status updates, or intel to the Rocky mobile app. Call this whenever you finish a task, encounter an error, or have an important update.",
        inputSchema: {
          type: "object",
          properties: {
            app_name: {
              type: "string",
              description: "The name of your application (e.g., 'Claude Desktop', 'Cursor', 'Codex')",
            },
            project_name: {
              type: "string",
              description: "The name or brief description of the current project/task you are working on",
            },
            details: {
              type: "string",
              description: "A detailed summary of what you just did or the current status.",
            },
          },
          required: ["app_name", "project_name", "details"],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "transmit_rocky_intel") {
    const { app_name, project_name, details } = request.params.arguments;
    
    // Format the payload exactly how Rocky's Zero-Click bridge expects it
    const payload = `[${app_name.toUpperCase()}] Project: ${project_name}\n${details}`;
    
    try {
      const commsFile = path.resolve(__dirname, '../../tmp_antigravity_reply.txt');
      fs.writeFileSync(commsFile, payload);
      
      return {
        content: [
          {
            type: "text",
            text: "Successfully transmitted intel to the Rocky Mobile App.",
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to transmit intel: ${err.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error("Tool not found");
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Rocky MCP Telemetry Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error in MCP Server:", err);
  process.exit(1);
});
