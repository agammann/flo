import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const mcpUrl = process.env.MCP_URL ?? "http://127.0.0.1:4100/mcp";
const client = new Client(
  { name: "flo-demo-reset", version: "0.1.0" },
  { versionNegotiation: { mode: "legacy" } }
);
const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
  requestInit: { headers: { "x-flo-role": "administrator", "x-flo-actor-id": "admin-demo" } }
});

try {
  await client.connect(transport);
  const result = await client.callTool({
    name: "reset_demo",
    arguments: { confirmation: "RESET FLO DEMO" }
  });
  if (result.isError === true) throw new Error("The MCP server rejected the demo reset.");
  console.log(`Flo demo reset through MCP ${transport.protocolVersion ?? "unknown"}. Services, orders, approvals, schedule, pending confirmations, and job memory restored.`);
} finally {
  await client.close();
}
