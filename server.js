#!/usr/bin/env node

const readline = require(“readline”);

// MCP Protocol version
const PROTOCOL_VERSION = “2024-11-05”;

// Server information
const SERVER_INFO = {
name: “example-mcp-server”,
version: “1.0.0”
};

// Tool definitions
const TOOLS = [
{
name: “get_time”,
description: “Returns the current server time in ISO format”,
inputSchema: {
type: “object”,
properties: {},
additionalProperties: false
}
},
{
name: “echo”,
description: “Echoes back a message with optional prefix”,
inputSchema: {
type: “object”,
properties: {
message: {
type: “string”,
description: “The message to echo back”
},
prefix: {
type: “string”,
description: “Optional prefix to add to the message”,
default: “Echo: “
}
},
required: [“message”],
additionalProperties: false
}
},
{
name: “add_numbers”,
description: “Adds two numbers together”,
inputSchema: {
type: “object”,
properties: {
a: {
type: “number”,
description: “First number”
},
b: {
type: “number”,
description: “Second number”
}
},
required: [“a”, “b”],
additionalProperties: false
}
}
];

// Tool implementations
const toolImplementations = {
get_time: async (args) => {
return {
content: [
{
type: “text”,
text: `Current time: ${new Date().toISOString()}`
}
]
};
},

echo: async (args) => {
const { message, prefix = “Echo: “ } = args;
return {
content: [
{
type: “text”,
text: `${prefix}${message}`
}
]
};
},

add_numbers: async (args) => {
const { a, b } = args;
const result = a + b;
return {
content: [
{
type: “text”,
text: `${a} + ${b} = ${result}`
}
]
};
}
};

// STDIO interface
const rl = readline.createInterface({
input: process.stdin,
output: process.stdout,
terminal: false
});

// Send JSON-RPC response
function sendResponse(response) {
const message = JSON.stringify(response);
process.stdout.write(message + “\n”);
}

// Send JSON-RPC error
function sendError(id, code, message, data = null) {
sendResponse({
jsonrpc: “2.0”,
id,
error: {
code,
message,
…(data && { data })
}
});
}

// Validation helpers
function validateToolCall(name, args) {
const tool = TOOLS.find(t => t.name === name);
if (!tool) {
throw new Error(`Tool '${name}' not found`);
}

// Basic validation - in production you’d want more robust JSON schema validation
const required = tool.inputSchema.required || [];
for (const field of required) {
if (!(field in args)) {
throw new Error(`Missing required parameter: ${field}`);
}
}

return tool;
}

// Main message handler
rl.on(“line”, async (line) => {
let request;

try {
request = JSON.parse(line.trim());
} catch (e) {
return sendError(null, -32700, “Parse error: Invalid JSON”);
}

// Validate JSON-RPC format
if (request.jsonrpc !== “2.0”) {
return sendError(request.id || null, -32600, “Invalid Request: Missing or invalid jsonrpc version”);
}

if (!request.method) {
return sendError(request.id || null, -32600, “Invalid Request: Missing method”);
}

const { id, method, params = {} } = request;

try {
switch (method) {
case “initialize”:
// MCP initialization handshake
const { protocolVersion, clientInfo } = params;

```
    if (protocolVersion !== PROTOCOL_VERSION) {
      return sendError(id, -32602, `Unsupported protocol version: ${protocolVersion}`);
    }
    
    sendResponse({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: {}
        },
        serverInfo: SERVER_INFO
      }
    });
    break;
    
  case "initialized":
    // Initialization complete notification - no response needed
    break;
    
  case "tools/list":
    // Return available tools
    sendResponse({
      jsonrpc: "2.0",
      id,
      result: {
        tools: TOOLS
      }
    });
    break;
    
  case "tools/call":
    // Execute a tool
    const { name, arguments: toolArgs = {} } = params;
    
    if (!name) {
      return sendError(id, -32602, "Invalid params: Missing tool name");
    }
    
    try {
      // Validate tool and arguments
      validateToolCall(name, toolArgs);
      
      // Execute tool
      const implementation = toolImplementations[name];
      if (!implementation) {
        return sendError(id, -32601, `Tool implementation not found: ${name}`);
      }
      
      const result = await implementation(toolArgs);
      
      sendResponse({
        jsonrpc: "2.0",
        id,
        result
      });
      
    } catch (toolError) {
      return sendError(id, -32603, `Tool execution error: ${toolError.message}`);
    }
    break;
    
  default:
    sendError(id, -32601, `Method not found: ${method}`);
}
```

} catch (error) {
sendError(id, -32603, `Internal error: ${error.message}`);
}
});

// Handle process termination gracefully
process.on(‘SIGINT’, () => {
rl.close();
process.exit(0);
});

process.on(‘SIGTERM’, () => {
rl.close();
process.exit(0);
});

// Error handling
process.on(‘uncaughtException’, (error) => {
console.error(‘Uncaught Exception:’, error);
process.exit(1);
});

process.on(‘unhandledRejection’, (reason, promise) => {
console.error(‘Unhandled Rejection at:’, promise, ‘reason:’, reason);
process.exit(1);
});
