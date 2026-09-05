import { createServer, type Server as HttpServer } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { hostHeaderValidation, localhostHostValidation, localhostOriginValidation, originValidation, toNodeHandler } from "@modelcontextprotocol/node";
import { FloOrchestrator, InMemoryJobMemoryStore } from "@flo/agent";
import { createHttpAdapters, type AdapterSet } from "@flo/adapters";
import { demoActors } from "@flo/domain";
import type { Actor, Role } from "@flo/shared-types";
import { isDemoModeEnabled } from "./runtime-config.js";
import { createFloMcpServer } from "./tools.js";

export { isDemoModeEnabled } from "./runtime-config.js";

export interface FloServerOptions {
  adapters?: AdapterSet;
  host?: string;
  allowedHostnames?: string[];
  allowedOriginHostnames?: string[];
  clock?: () => Date;
  demoMode?: boolean;
}

const roleActors: Record<Role, Actor> = {
  technician: demoActors.technician,
  service_advisor: demoActors.serviceAdvisor,
  manager: demoActors.manager,
  administrator: demoActors.administrator
};

const actorFromRequest = (request: Request | undefined): Actor => {
  const requestedRole = request?.headers.get("x-flo-role") ?? "technician";
  const role = requestedRole in roleActors ? requestedRole as Role : "technician";
  const base = roleActors[role];
  const requestedId = request?.headers.get("x-flo-actor-id");
  if (process.env.FLO_AUTH_MODE === "required" && request?.headers.get("authorization") === null) {
    throw new Error("Authentication is required before constructing a Flo actor.");
  }
  return { ...base, id: requestedId ?? base.id, assignedWorkOrderIds: [...base.assignedWorkOrderIds] };
};

const defaultAdapters = (): AdapterSet => createHttpAdapters({
  shop: process.env.SHOP_API_URL ?? "http://127.0.0.1:4101",
  inventory: process.env.INVENTORY_API_URL ?? "http://127.0.0.1:4102",
  supplier: process.env.SUPPLIER_API_URL ?? "http://127.0.0.1:4103",
  customer: process.env.CUSTOMER_API_URL ?? "http://127.0.0.1:4104"
});

export const createFloHttpServer = (options: FloServerOptions = {}): { server: HttpServer; orchestrator: FloOrchestrator; close(): Promise<void> } => {
  const host = options.host ?? "127.0.0.1";
  const adapters = options.adapters ?? defaultAdapters();
  const orchestrator = new FloOrchestrator(adapters, new InMemoryJobMemoryStore(), options.clock);
  const demoMode = options.demoMode ?? isDemoModeEnabled();
  const handler = createMcpHandler(({ requestInfo }) => createFloMcpServer(orchestrator, actorFromRequest(requestInfo), { demoMode }), { legacy: "stateless" });
  const nodeHandler = toNodeHandler(handler);
  const validateHost = options.allowedHostnames === undefined ? localhostHostValidation() : hostHeaderValidation(options.allowedHostnames);
  const validateOrigin = options.allowedOriginHostnames === undefined ? localhostOriginValidation() : originValidation(options.allowedOriginHostnames);

  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? host}`);
    if (requestUrl.pathname === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, service: "flo-mcp", protocol: "MCP Streamable HTTP", minimumProtocolVersion: "2025-11-25" }));
      return;
    }
    if (requestUrl.pathname !== "/mcp") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Not found" }));
      return;
    }
    if (!validateHost(request, response) || !validateOrigin(request, response)) return;
    void nodeHandler(request as Parameters<typeof nodeHandler>[0], response);
  });

  return {
    server,
    orchestrator,
    close: async () => {
      await handler.close();
      await new Promise<void>((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));
    }
  };
};
