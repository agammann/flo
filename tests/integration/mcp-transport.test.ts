import assert from "node:assert/strict";
import { createServer, request as httpRequest, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import express, { type Express } from "express";
import type * as CustomerRouterModule from "../../apps/alexa-simulator/dist/customer-router.js";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createHttpAdapters } from "@flo/adapters";
import { createCustomerApi } from "@flo/mock-customer-api";
import { createInventoryApi } from "@flo/mock-inventory-api";
import { createShopApi } from "@flo/mock-shop-api";
import { createSupplierApi } from "@flo/mock-supplier-api";
import { createFloHttpServer } from "@flo/mcp";

const fixedNow = new Date("2026-09-03T12:00:00.000Z");

const listenExpress = async (app: Express): Promise<{ server: Server; url: string }> => new Promise((resolve, reject) => {
  const server = app.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (address === null || typeof address === "string") {
      reject(new Error("Could not determine test server address."));
      return;
    }
    resolve({ server, url: `http://127.0.0.1:${address.port}` });
  });
  server.on("error", reject);
});

const listenNode = async (server: Server): Promise<string> => new Promise((resolve, reject) => {
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (address === null || typeof address === "string") {
      reject(new Error("Could not determine MCP server address."));
      return;
    }
    resolve(`http://127.0.0.1:${address.port}`);
  });
  server.on("error", reject);
});

const close = async (server: Server): Promise<void> => new Promise((resolve, reject) => {
  server.close((error) => error === undefined ? resolve() : reject(error));
});

describe("Flo MCP Streamable HTTP transport", () => {
  const serviceServers: Server[] = [];
  let mcp: ReturnType<typeof createFloHttpServer>;
  let mcpUrl: string;
  let adapters: ReturnType<typeof createHttpAdapters>;

  before(async () => {
    const [shop, inventory, supplier, customer] = await Promise.all([
      listenExpress(createShopApi(fixedNow).app),
      listenExpress(createInventoryApi(fixedNow).app),
      listenExpress(createSupplierApi(fixedNow).app),
      listenExpress(createCustomerApi(fixedNow).app)
    ]);
    serviceServers.push(shop.server, inventory.server, supplier.server, customer.server);
    adapters = createHttpAdapters({
      shop: shop.url,
      inventory: inventory.url,
      supplier: supplier.url,
      customer: customer.url
    });
    mcp = createFloHttpServer({ adapters, clock: () => new Date(fixedNow), demoMode: true });
    mcpUrl = await listenNode(mcp.server);
  });

  after(async () => {
    await mcp.close();
    await Promise.all(serviceServers.map(close));
  });

  it("rejects malformed Host and request targets without killing the listener", async () => {
    const raw = (host: string, path: string): Promise<number> => new Promise((resolve, reject) => {
      const request = httpRequest(mcpUrl, { path, headers: { Host: host }, agent: false }, response => { response.resume(); response.on("end", () => resolve(response.statusCode!)); });
      request.on("error", reject); request.end();
    });
    for (const host of ["[", "[::1", "attacker.example", "localhost@attacker.example"]) {
      for (const path of ["/mcp", "/health", "/customer/mcp"]) assert.equal(await raw(host, path), 403);
      assert.equal((await fetch(`${mcpUrl}/health`)).status, 200);
    }
    for (const path of ["http://attacker.example/mcp", "//attacker.example/mcp", "/\\attacker.example/mcp"]) assert.equal(await raw(new URL(mcpUrl).host, path), 400);
    assert.equal((await fetch(`${mcpUrl}/health`)).status, 200);
  });

  it("negotiates the required 2025-11-25 protocol and invokes a real tool", async () => {
    const client = new Client(
      { name: "flo-integration-test", version: "0.1.0" },
      { versionNegotiation: { mode: "legacy" } }
    );
    const transport = new StreamableHTTPClientTransport(new URL(`${mcpUrl}/mcp`), {
      requestInit: { headers: { "x-flo-role": "technician" } }
    });

    try {
      await client.connect(transport);
      assert.equal(transport.protocolVersion, "2025-11-25");

      const listed = await client.listTools();
      assert.equal(listed.tools.length, 28);
      assert.ok(listed.tools.some((tool) => tool.name === "get_work_order"));
      assert.ok(listed.tools.some((tool) => tool.name === "confirm_transaction"));

      const representativeFields: Record<string, string> = {
        get_work_order: "workOrderNumber",
        list_open_work_orders: "workOrderNumber",
        search_work_orders: "workOrderNumber",
        add_work_order_note: "notes",
        get_asset: "make",
        record_diagnostic: "finding",
        get_diagnostic_history: "finding",
        search_parts: "partNumber",
        check_part_compatibility: "reasonCode",
        search_inventory: "available",
        search_suppliers: "offers",
        compare_parts: "recommendation",
        calculate_estimate: "totalCents",
        create_estimate: "totalCents",
        get_estimate: "totalCents",
        get_customer: "preferredContactMethod",
        send_customer_message: "sentAt",
        request_customer_approval: "requestedAt",
        get_customer_approval_status: "requestedAt",
        simulate_customer_approval: "requestedAt",
        get_schedule: "bayId",
        find_available_slot: "conflicts",
        prepare_purchase_and_schedule: "confirmationToken",
        confirm_transaction: "scheduleSlot",
        get_order_status: "idempotencyKey",
        get_job_status: "purchaseOrder",
        get_demo_time_window: "start",
        reset_demo: "reset"
      };
      for (const [name, field] of Object.entries(representativeFields)) {
        const tool = listed.tools.find((candidate) => candidate.name === name);
        assert.ok(tool !== undefined, `${name} should be registered.`);
        assert.equal((tool.outputSchema as { type?: unknown }).type, "object", `${name} should advertise an object-root output schema.`);
        assert.ok(JSON.stringify(tool.outputSchema).includes(`"${field}"`), `${name} should advertise its ${field} output field.`);
      }

      const workOrderTool = listed.tools.find((tool) => tool.name === "get_work_order");
      const estimateTool = listed.tools.find((tool) => tool.name === "create_estimate");
      assert.notDeepEqual(workOrderTool?.outputSchema, estimateTool?.outputSchema);

      const result = await client.callTool({
        name: "get_work_order",
        arguments: { idOrNumber: "1842" }
      });
      assert.equal(result.isError, undefined);
      const envelope = result.structuredContent as { ok: boolean; data: { workOrderNumber: string; assetId: string } };
      assert.equal(envelope.ok, true);
      assert.equal(envelope.data.workOrderNumber, "1842");
      assert.equal(envelope.data.assetId, "asset-f150-2019");
      const spokenFallback = result.content.find((item) => item.type === "text");
      assert.equal(spokenFallback?.type, "text");
      if (spokenFallback?.type === "text") {
        assert.match(spokenFallback.text, /Work order 1842 was retrieved/);
        assert.doesNotMatch(spokenFallback.text, /^\s*\{/);
      }
    } finally {
      await client.close();
    }
  });

  it("bounds declared and streamed bodies, batches and tool arguments on both MCP surfaces", async () => {
    const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-11-25" };
    const batch = (count: number) => Array.from({ length: count }, () => ({ jsonrpc: "2.0", method: "notifications/initialized" }));
    for (const path of ["/mcp", "/customer/mcp"]) {
      const post = (body: unknown) => fetch(`${mcpUrl}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
      assert.equal((await post({ jsonrpc: "2.0", id: 1, method: "ping", params: { padding: "x".repeat(64 * 1024) } })).status, 413);
      const streamed = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping", params: { padding: "é".repeat(33 * 1024) } }));
      const status = await new Promise<number>((resolve, reject) => {
        const request = httpRequest(new URL(path, mcpUrl), { method: "POST", headers: { ...headers, "Transfer-Encoding": "chunked" } }, response => { response.resume(); response.on("end", () => resolve(response.statusCode!)); });
        request.on("error", reject); request.write(streamed.subarray(0, 32000)); request.end(streamed.subarray(32000));
      });
      assert.equal(status, 413);
      assert.equal((await post(batch(100))).status, 202);
      const excessiveBatch = await post(batch(101));
      assert.equal(excessiveBatch.status, 400);
      assert.match(await excessiveBatch.text(), /100 messages/);
      const client = new Client({ name: "bounded-input", version: "1" }, { versionNegotiation: { mode: "legacy" } });
      try {
        await client.connect(new StreamableHTTPClientTransport(new URL(`${mcpUrl}${path}`)));
        const name = path === "/mcp" ? "search_suppliers" : "list_my_repairs";
        const excessive = await client.callTool({ name, arguments: { partIds: Array(1000).fill("part-alternator-balanced") } });
        assert.equal(excessive.isError, true);
        assert.match(JSON.stringify(excessive.content), /1000|elements/i);
        const control = await client.callTool({ name, arguments: path === "/mcp" ? { partIds: Array(999).fill("part-alternator-balanced") } : {} });
        assert.notEqual(control.isError, true);
      } finally { await client.close(); }
      assert.equal((await fetch(`${mcpUrl}/health`)).status, 200);
    }
  });

  it("keeps identity headers and bodies on their origin across 307 and 308 redirects", async () => {
    let leakedRequests = 0; let sameOriginRequests = 0;
    const sink = createServer((request, response) => { leakedRequests++; request.resume(); response.writeHead(204).end(); });
    const sinkUrl = await listenNode(sink);
    const origin = createServer((request, response) => { void (async () => {
      if (request.method !== "POST") { response.writeHead(405).end(); return; }
      const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(chunk as Buffer);
      const body = Buffer.concat(chunks).toString();
      if (request.url?.startsWith("/cross")) { response.writeHead(Number(request.url.slice(-3)), { Location: `${sinkUrl}/capture` }).end(); return; }
      if (request.url?.startsWith("/same")) { response.writeHead(Number(request.url.slice(-3)), { Location: "/destination" }).end(); return; }
      sameOriginRequests++;
      assert.equal(request.headers["x-flo-role"], "technician");
      assert.equal(request.headers["x-flo-actor-id"], "synthetic-redirect-test");
      const message = JSON.parse(body) as { id?: number; method: string };
      if (message.id === undefined) { response.writeHead(202).end(); return; }
      assert.equal(message.method, "initialize");
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2025-11-25", capabilities: {}, serverInfo: { name: "redirect-control", version: "1" } } }));
    })().catch((error: unknown) => response.destroy(error instanceof Error ? error : new Error("Redirect fixture failed"))); });
    const originUrl = await listenNode(origin);
    try {
      for (const path of ["/cross307", "/cross308", "/same307", "/same308", "/destination"]) {
        const client = new Client({ name: "redirect-test", version: "1" }, { versionNegotiation: { mode: "legacy" } });
        try {
          const connect = client.connect(new StreamableHTTPClientTransport(new URL(`${originUrl}${path}`), { requestInit: { headers: { "x-flo-role": "technician", "x-flo-actor-id": "synthetic-redirect-test" } } }));
          if (path.startsWith("/cross")) await assert.rejects(connect, /redirect|origin/i); else await connect;
        } finally { await client.close(); }
      }
      assert.equal(leakedRequests, 0);
      assert.ok(sameOriginRequests >= 3);
    } finally { await close(origin); await close(sink); }
  });

  it("isolates the owner tool surface and ignores client-supplied identity headers", async () => {
    const client = new Client({ name: "flo-owner-test", version: "0.2.0" }, { versionNegotiation: { mode: "legacy" } });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(`${mcpUrl}/customer/mcp`), {
        requestInit: { headers: { "x-flo-role": "administrator", "x-flo-actor-id": "customer-002", "x-flo-customer-id": "customer-002" } }
      }));
      const listed = await client.listTools();
      assert.deepEqual(listed.tools.map(tool => tool.name).sort(), ["get_my_estimate", "get_my_repair", "list_my_repairs"]);
      for (const tool of listed.tools) {
        assert.equal(tool.annotations?.readOnlyHint, true);
        assert.ok(tool.outputSchema !== undefined);
      }
      const own = await client.callTool({ name: "get_my_repair", arguments: { repairNumber: "1842" } });
      assert.notEqual(own.isError, true);
      const serialized = JSON.stringify(own.structuredContent);
      assert.match(serialized, /2019 Ford F-150/);
      assert.doesNotMatch(serialized, /"(?:vin|customerId|technician|complaint|diagnosis|margin)":/i);
      const work = await adapters.shop.listWorkOrders();
      const other = work.find(item => item.customerId !== "customer-001");
      assert.ok(other);
      const forbidden = await client.callTool({ name: "get_my_repair", arguments: { repairNumber: other.workOrderNumber } });
      const missing = await client.callTool({ name: "get_my_repair", arguments: { repairNumber: "99999999" } });
      assert.equal(forbidden.isError, true);
      assert.deepEqual(forbidden.structuredContent, missing.structuredContent);
      const override = await client.callTool({ name: "list_my_repairs", arguments: { customerId: other.customerId } });
      assert.equal(override.isError, true);
      const unavailableEstimate = await client.callTool({ name: "get_my_estimate", arguments: { repairNumber: "1842" } });
      assert.equal(unavailableEstimate.isError, true);
      assert.match(JSON.stringify(unavailableEstimate.content), /has not prepared an estimate/);
    } finally { await client.close(); }
  });

  it("runs the customer preview through MCP and rejects missing consent, identity overrides and unsupported actions", async () => {
    const { createCustomerRouter } = await import(new URL("../../../apps/alexa-simulator/dist/customer-router.js", import.meta.url).href) as typeof CustomerRouterModule;
    const app = express();
    app.use(express.json());
    app.use(createCustomerRouter(`${mcpUrl}/customer/mcp`, true));
    const preview = await listenExpress(app);
    const send = async (body: unknown) => {
      const response = await fetch(`${preview.url}/command`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() as { voice: string; tools?: string[]; data?: { repairNumber: string } } };
    };
    try {
      assert.equal((await send({ command: "Show my repairs" })).status, 400);
      assert.equal((await send({ command: "Show my repairs", demoConsent: true, customerId: "customer-002" })).status, 400);
      assert.equal((await send({ command: " ", demoConsent: true })).status, 400);
      for (const command of ["Approve estimate 1842", "Pay for repair 1842", "Book repair 1842", "Cancel repair 1842"]) {
        const result = await send({ command, demoConsent: true });
        assert.deepEqual(result.body.tools, []);
        assert.match(result.body.voice, /Nothing has been changed/);
      }
      const ambiguous = await send({ command: "Review repair 1842 or 1843", demoConsent: true });
      assert.deepEqual(ambiguous.body.tools, []);
      assert.match(ambiguous.body.voice, /Which repair/);
      const unsupported = await send({ command: "Tell me the weather", demoConsent: true });
      assert.deepEqual(unsupported.body.tools, []);
      const status = await send({ command: "Status of repair 1842", demoConsent: true });
      assert.equal(status.status, 200);
      assert.deepEqual(status.body.tools, ["get_my_repair"]);
      assert.equal(status.body.data?.repairNumber, "1842");
    } finally { await close(preview.server); }
  });

  it("omits simulator-only controls from the production tool surface", async () => {
    const productionMcp = createFloHttpServer({ adapters, clock: () => new Date(fixedNow), demoMode: false });
    const productionUrl = await listenNode(productionMcp.server);
    const productionClient = new Client(
      { name: "flo-production-surface-test", version: "0.1.0" },
      { versionNegotiation: { mode: "legacy" } }
    );
    const productionTransport = new StreamableHTTPClientTransport(new URL(`${productionUrl}/mcp`), {
      requestInit: { headers: { "x-flo-role": "technician" } }
    });

    try {
      const denied = await fetch(`${productionUrl}/customer/mcp`, { headers: { Authorization: "Bearer unverified-token", "x-flo-customer-id": "customer-001" } });
      assert.equal(denied.status, 401);
      assert.equal(denied.headers.get("www-authenticate"), null);
      await productionClient.connect(productionTransport);
      const listed = await productionClient.listTools();
      assert.equal(listed.tools.length, 25);
      assert.ok(!listed.tools.some((tool) => ["simulate_customer_approval", "get_demo_time_window", "reset_demo"].includes(tool.name)));
    } finally {
      await productionClient.close();
      await productionMcp.close();
    }
  });
});
