import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import type { Express } from "express";
import { createHttpAdapters, type AdapterSet, type ShopAdapter } from "@flo/adapters";
import { FloOrchestrator, InMemoryJobMemoryStore } from "@flo/agent";
import { demoActors } from "@flo/domain";
import { createCustomerApi } from "@flo/mock-customer-api";
import { createInventoryApi } from "@flo/mock-inventory-api";
import { createShopApi } from "@flo/mock-shop-api";
import { createSupplierApi } from "@flo/mock-supplier-api";
import { FloError } from "@flo/shared-types";

const fixedNow = new Date("2026-09-03T12:00:00.000Z");

const listen = async (app: Express): Promise<{ server: Server; url: string }> => new Promise((resolve, reject) => {
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

const close = async (server: Server): Promise<void> => new Promise((resolve, reject) => {
  server.close((error) => error === undefined ? resolve() : reject(error));
});

describe("transaction and reference safety failures", () => {
  const servers: Server[] = [];
  let adapters: AdapterSet;
  let orchestrator: FloOrchestrator;

  before(async () => {
    const [shop, inventory, supplier, customer] = await Promise.all([
      listen(createShopApi(fixedNow).app),
      listen(createInventoryApi(fixedNow).app),
      listen(createSupplierApi(fixedNow).app),
      listen(createCustomerApi(fixedNow).app)
    ]);
    servers.push(shop.server, inventory.server, supplier.server, customer.server);
    adapters = createHttpAdapters({ shop: shop.url, inventory: inventory.url, supplier: supplier.url, customer: customer.url });
  });

  beforeEach(async () => {
    await Promise.all([adapters.shop.reset(), adapters.inventory.reset(), adapters.supplier.reset(), adapters.customer.reset()]);
    orchestrator = new FloOrchestrator(adapters, new InMemoryJobMemoryStore(), () => new Date(fixedNow));
  });

  after(async () => { await Promise.all(servers.map(close)); });

  it("asks for clarification when Ford matches multiple visible jobs and no recent context exists", async () => {
    await assert.rejects(
      orchestrator.getJobStatus(demoActors.manager, "Ford"),
      (error: unknown) => error instanceof FloError && error.code === "AMBIGUOUS_REFERENCE" && (error.recovery?.length ?? 0) >= 2
    );
  });

  it("will not prepare a purchase before customer approval is requested", async () => {
    const actor = demoActors.technician;
    await orchestrator.getWorkOrder(actor, "1842");
    await orchestrator.compareParts(actor, { category: "alternator", excludeCheapest: true });
    const window = await orchestrator.getDefaultTomorrowMorning();
    await assert.rejects(
      orchestrator.preparePurchaseAndSchedule(actor, { bayId: "bay-2", start: window.start, end: window.end }),
      (error: unknown) => error instanceof FloError && error.code === "APPROVAL_REQUIRED"
    );
  });

  it("rechecks the bay at confirmation and rejects a concurrent schedule conflict", async () => {
    const actor = demoActors.technician;
    await orchestrator.getWorkOrder(actor, "1842");
    await orchestrator.compareParts(actor, { category: "alternator", excludeCheapest: true });
    await orchestrator.createEstimate(actor, {});
    const approval = await orchestrator.requestCustomerApproval(actor);
    await orchestrator.simulateCustomerApproval(actor, "approved", approval.id);
    const window = await orchestrator.getDefaultTomorrowMorning();
    const prepared = await orchestrator.preparePurchaseAndSchedule(actor, { bayId: "bay-2", start: window.start, end: window.end });

    await adapters.shop.schedule({
      id: "slot-concurrent-conflict",
      bayId: "bay-2",
      start: window.start,
      end: window.end,
      workOrderId: "wo-2001",
      technicianId: "tech-002"
    });

    await assert.rejects(
      orchestrator.confirmTransaction(actor, prepared.confirmationToken),
      (error: unknown) => error instanceof FloError && error.code === "BAY_CONFLICT"
    );
  });

  it("cancels a placed order when schedule creation fails after the final availability check", async () => {
    const actor = demoActors.technician;
    const failingShop: ShopAdapter = {
      listWorkOrders: (filters) => adapters.shop.listWorkOrders(filters),
      getWorkOrder: (idOrNumber) => adapters.shop.getWorkOrder(idOrNumber),
      updateWorkOrder: (idOrNumber, update) => adapters.shop.updateWorkOrder(idOrNumber, update),
      addDiagnostic: (workOrderId, technicianId, finding) => adapters.shop.addDiagnostic(workOrderId, technicianId, finding),
      getDiagnostics: (workOrderId) => adapters.shop.getDiagnostics(workOrderId),
      getAsset: (id) => adapters.shop.getAsset(id),
      saveEstimate: (estimate) => adapters.shop.saveEstimate(estimate),
      updateEstimate: (id, update) => adapters.shop.updateEstimate(id, update),
      getEstimate: (idOrWorkOrderId) => adapters.shop.getEstimate(idOrWorkOrderId),
      getSchedule: (filters) => adapters.shop.getSchedule(filters),
      schedule: async () => { throw new FloError({ code: "SCHEDULE_WRITE_FAILED", message: "The schedule service rejected the write.", retryable: true }); },
      writeAudit: (log) => adapters.shop.writeAudit(log),
      reset: () => adapters.shop.reset()
    };
    const rollbackOrchestrator = new FloOrchestrator({ ...adapters, shop: failingShop }, new InMemoryJobMemoryStore(), () => new Date(fixedNow));

    await rollbackOrchestrator.getWorkOrder(actor, "1842");
    await rollbackOrchestrator.compareParts(actor, { category: "alternator", excludeCheapest: true });
    await rollbackOrchestrator.createEstimate(actor, {});
    const approval = await rollbackOrchestrator.requestCustomerApproval(actor);
    await rollbackOrchestrator.simulateCustomerApproval(actor, "approved", approval.id);
    const window = await rollbackOrchestrator.getDefaultTomorrowMorning();
    const idempotencyKey = "rollback-schedule-test";
    const prepared = await rollbackOrchestrator.preparePurchaseAndSchedule(actor, { bayId: "bay-2", start: window.start, end: window.end, idempotencyKey });

    await assert.rejects(
      rollbackOrchestrator.confirmTransaction(actor, prepared.confirmationToken),
      (error: unknown) => error instanceof FloError && error.code === "TRANSACTION_ROLLED_BACK"
    );
    const order = await adapters.supplier.getOrderStatus(idempotencyKey);
    assert.equal(order.status, "cancelled");
  });
});
