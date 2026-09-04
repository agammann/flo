import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import type { Express } from "express";
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
    mcp = createFloHttpServer({ adapters, clock: () => new Date(fixedNow) });
    mcpUrl = await listenNode(mcp.server);
  });

  after(async () => {
    await mcp.close();
    await Promise.all(serviceServers.map(close));
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
      assert.ok(listed.tools.length >= 25);
      assert.ok(listed.tools.some((tool) => tool.name === "get_work_order"));
      assert.ok(listed.tools.some((tool) => tool.name === "confirm_transaction"));

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
