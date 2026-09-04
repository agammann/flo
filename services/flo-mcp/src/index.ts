import { createFloHttpServer } from "./server.js";

const port = Number(process.env.MCP_PORT ?? 4100);
const host = process.env.MCP_HOST ?? "127.0.0.1";
const allowedHostnames = process.env.ALLOWED_HOSTNAMES?.split(",").map((value) => value.trim()).filter(Boolean);
const allowedOriginHostnames = process.env.ALLOWED_ORIGIN_HOSTNAMES?.split(",").map((value) => value.trim()).filter(Boolean);
const application = createFloHttpServer({
  host,
  ...(allowedHostnames === undefined || allowedHostnames.length === 0 ? {} : { allowedHostnames }),
  ...(allowedOriginHostnames === undefined || allowedOriginHostnames.length === 0 ? {} : { allowedOriginHostnames })
});

application.server.listen(port, host, () => {
  console.log(JSON.stringify({ level: "info", service: "flo-mcp", event: "listening", transport: "streamable-http", endpoint: `http://${host}:${port}/mcp`, minimumProtocolVersion: "2025-11-25" }));
});

const shutdown = (): void => {
  void application.close().finally(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export * from "./server.js";
export * from "./tools.js";
