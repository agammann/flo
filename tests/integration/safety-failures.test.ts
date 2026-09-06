import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import type { Express } from "express";
import { createHttpAdapters, type AdapterSet, type CustomerAdapter, type InventoryAdapter, type ShopAdapter, type SupplierAdapter } from "@flo/adapters";
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

  it("authorizes order status by the returned work order for both ID and idempotency key", async () => {
    for (const workOrderId of ["wo-1842", "wo-1844"]) {
      const placed = await adapters.supplier.placeOrder({ supplierId: "supplier-b", supplierSku: "PM-ALT-7842", quantity: 1, workOrderId, idempotencyKey: `isolation-${workOrderId}` });
      for (const reference of [placed.order.id, placed.order.idempotencyKey]) {
        if (workOrderId === "wo-1842") assert.equal((await orchestrator.getOrderStatus(demoActors.technician, reference)).id, placed.order.id);
        else await assert.rejects(orchestrator.getOrderStatus(demoActors.technician, reference), error => error instanceof FloError && error.code === "WORK_ORDER_ACCESS_DENIED");
        assert.equal((await orchestrator.getOrderStatus(demoActors.manager, reference)).id, placed.order.id);
      }
    }
  });

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

  it("rejects an incompatible supplier SKU before previewing or saving an estimate", async () => {
    const actor = demoActors.technician;
    await orchestrator.getWorkOrder(actor, "1842");

    await assert.rejects(
      orchestrator.calculateEstimatePreview(actor, { supplierSku: "VL-ALT-GM220" }),
      (error: unknown) => error instanceof FloError && error.code === "PART_INCOMPATIBLE"
    );
    await assert.rejects(
      orchestrator.createEstimate(actor, { supplierSku: "VL-ALT-GM220" }),
      (error: unknown) => error instanceof FloError && error.code === "PART_INCOMPATIBLE"
    );
    await assert.rejects(
      adapters.shop.getEstimate("wo-1842"),
      (error: unknown) => error instanceof FloError && error.code === "NOT_FOUND"
    );
  });

  it("binds purchase preparation and execution to the exact approved estimate SKU", async () => {
    const actor = demoActors.technician;
    await orchestrator.getWorkOrder(actor, "1842");
    await orchestrator.compareParts(actor, { category: "alternator", excludeCheapest: true });
    const estimate = await orchestrator.createEstimate(actor, {});
    const approvedSku = estimate.partItems[0]?.supplierSku;
    assert.equal(approvedSku, "PM-ALT-7842");
    const approval = await orchestrator.requestCustomerApproval(actor);
    await orchestrator.simulateCustomerApproval(actor, "approved", approval.id);

    await orchestrator.compareParts(actor, { category: "alternator", maximumLandedCostCents: 20000 });
    const window = await orchestrator.getDefaultTomorrowMorning();
    await assert.rejects(
      orchestrator.preparePurchaseAndSchedule(actor, { bayId: "bay-2", start: window.start, end: window.end, supplierSku: "VL-ALT-5410" }),
      (error: unknown) => error instanceof FloError && error.code === "APPROVED_ESTIMATE_MISMATCH"
    );

    const prepared = await orchestrator.preparePurchaseAndSchedule(actor, { bayId: "bay-2", start: window.start, end: window.end });
    assert.match(prepared.summary, /PM-ALT-7842/);
    assert.doesNotMatch(prepared.summary, /VL-ALT-5410/);
    const completed = await orchestrator.confirmTransaction(actor, prepared.confirmationToken);
    assert.equal(completed.purchaseOrder.items[0]?.supplierSku, approvedSku);
  });

  it("locks an estimate while its approval request is in flight", async () => {
    const actor = demoActors.technician;
    let signalRequestStarted = (): void => undefined;
    let releaseRequest = (): void => undefined;
    const requestStarted = new Promise<void>((resolve) => { signalRequestStarted = resolve; });
    const requestRelease = new Promise<void>((resolve) => { releaseRequest = resolve; });
    const delayedCustomer: CustomerAdapter = {
      getCustomer: (id) => adapters.customer.getCustomer(id),
      sendMessage: (input) => adapters.customer.sendMessage(input),
      requestApproval: async (input) => {
        signalRequestStarted();
        await requestRelease;
        return adapters.customer.requestApproval(input);
      },
      getApprovalStatus: (reference) => adapters.customer.getApprovalStatus(reference),
      simulateApproval: (id, status) => adapters.customer.simulateApproval(id, status),
      reset: () => adapters.customer.reset()
    };
    const raceOrchestrator = new FloOrchestrator({ ...adapters, customer: delayedCustomer }, new InMemoryJobMemoryStore(), () => new Date(fixedNow));
    await raceOrchestrator.getWorkOrder(actor, "1842");
    await raceOrchestrator.compareParts(actor, { category: "alternator", excludeCheapest: true });
    const estimate = await raceOrchestrator.createEstimate(actor, {});

    const approvalPromise = raceOrchestrator.requestCustomerApproval(actor);
    await requestStarted;
    const replacementAssertion = assert.rejects(
      raceOrchestrator.createEstimate(actor, { supplierSku: "PA-OE-9019" }),
      (error: unknown) => error instanceof FloError && error.code === "ESTIMATE_LOCKED"
    );
    releaseRequest();
    const approval = await approvalPromise;
    await replacementAssertion;

    const persisted = await adapters.shop.getEstimate(estimate.id);
    assert.equal(persisted.partItems[0]?.supplierSku, "PM-ALT-7842");
    assert.equal(approval.estimateId, persisted.id);
    assert.equal(approval.estimateFingerprint.length, 64);
  });

  it("uses the newest approval attempt and keeps a newer pending request gated", async () => {
    const actor = demoActors.technician;
    await orchestrator.getWorkOrder(actor, "1842");
    await orchestrator.compareParts(actor, { category: "alternator", excludeCheapest: true });
    const estimate = await orchestrator.createEstimate(actor, {});
    const first = await orchestrator.requestCustomerApproval(actor);
    await orchestrator.simulateCustomerApproval(actor, "approved", first.id);
    const workOrder = await adapters.shop.getWorkOrder("1842");
    const second = await adapters.customer.requestApproval({
      workOrderId: workOrder.id,
      estimateId: estimate.id,
      estimateFingerprint: first.estimateFingerprint,
      customerId: workOrder.customerId,
      summary: "A newer approval attempt must supersede the resolved record."
    });
    assert.notEqual(second.id, first.id);
    assert.equal(second.status, "pending");

    const current = await orchestrator.getCustomerApprovalStatus(actor, "1842");
    assert.equal(current.id, second.id);
    const window = await orchestrator.getDefaultTomorrowMorning();
    await assert.rejects(
      orchestrator.preparePurchaseAndSchedule(actor, { bayId: "bay-2", start: window.start, end: window.end }),
      (error: unknown) => error instanceof FloError && error.code === "APPROVAL_REQUIRED"
    );
  });

  it("authorizes a demo approval before mutating its provider state", async () => {
    const foreignWorkOrder = await adapters.shop.getWorkOrder("1844");
    const foreignApproval = await adapters.customer.requestApproval({
      workOrderId: foreignWorkOrder.id,
      estimateId: "estimate-foreign",
      estimateFingerprint: "a".repeat(64),
      customerId: foreignWorkOrder.customerId,
      summary: "Foreign approval used only for authorization regression coverage."
    });

    await assert.rejects(
      orchestrator.simulateCustomerApproval(demoActors.technician, "approved", foreignApproval.id),
      (error: unknown) => error instanceof FloError && error.code === "WORK_ORDER_ACCESS_DENIED"
    );
    assert.equal((await adapters.customer.getApprovalStatus(foreignApproval.id)).status, "pending");
  });

  it("rejects a provider part whose identity differs from the supplier offer", async () => {
    const mismatchedInventory: InventoryAdapter = {
      searchParts: (input) => adapters.inventory.searchParts(input),
      getPart: (reference) => reference === "part-alt-incompatible"
        ? adapters.inventory.getPart("part-alt-premium-219")
        : adapters.inventory.getPart(reference),
      searchInventory: (partId) => adapters.inventory.searchInventory(partId),
      reserve: (partId, quantity) => adapters.inventory.reserve(partId, quantity),
      reset: () => adapters.inventory.reset()
    };
    const guardedOrchestrator = new FloOrchestrator({ ...adapters, inventory: mismatchedInventory }, new InMemoryJobMemoryStore(), () => new Date(fixedNow));
    await guardedOrchestrator.getWorkOrder(demoActors.technician, "1842");
    await assert.rejects(
      guardedOrchestrator.createEstimate(demoActors.technician, { supplierSku: "VL-ALT-GM220" }),
      (error: unknown) => error instanceof FloError && error.code === "UPSTREAM_DATA_MISMATCH"
    );
  });

  it("isolates approval status and purchase gates by work order", async () => {
    const actor = demoActors.technician;
    const targetBefore = await orchestrator.getWorkOrder(actor, "1843");
    await orchestrator.getWorkOrder(actor, "1842");
    await orchestrator.compareParts(actor, { category: "alternator", excludeCheapest: true });
    await orchestrator.createEstimate(actor, {});
    const approval = await orchestrator.requestCustomerApproval(actor);
    await orchestrator.simulateCustomerApproval(actor, "approved", approval.id);

    await assert.rejects(
      orchestrator.getCustomerApprovalStatus(actor, "1843"),
      (error: unknown) => error instanceof FloError && error.code === "APPROVAL_NOT_FOUND"
    );
    const targetAfter = await orchestrator.getWorkOrder(actor, "1843");
    assert.equal(targetAfter.status, targetBefore.status);
    assert.equal(targetAfter.estimateId, null);

    const window = await orchestrator.getDefaultTomorrowMorning();
    await assert.rejects(
      orchestrator.preparePurchaseAndSchedule(actor, { workOrderIdOrNumber: "1843", bayId: "bay-2", start: window.start, end: window.end }),
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

  it("rejects a mismatched supplier replay before scheduling", async () => {
    const actor = demoActors.technician;
    let attempts = 0;
    const replayingSupplier: SupplierAdapter = {
      searchParts: (input) => adapters.supplier.searchParts(input),
      placeOrder: async (input) => {
        attempts += 1;
        if (attempts === 1) throw new FloError({ code: "UPSTREAM_TIMEOUT", message: "The supplier response timed out.", retryable: true });
        return {
          idempotentReplay: true,
          order: {
            id: "po-mismatched-replay",
            supplierId: input.supplierId,
            workOrderId: "wo-1844",
            items: [{ partId: "part-alt-incompatible", supplierSku: "VL-ALT-GM220", quantity: 1, unitCostCents: 17800 }],
            totalCents: 17800,
            status: "placed",
            idempotencyKey: input.idempotencyKey,
            createdAt: fixedNow.toISOString()
          }
        };
      },
      getOrderStatus: (reference) => adapters.supplier.getOrderStatus(reference),
      cancelOrder: (id) => adapters.supplier.cancelOrder(id),
      reset: () => adapters.supplier.reset()
    };
    const replayOrchestrator = new FloOrchestrator({ ...adapters, supplier: replayingSupplier }, new InMemoryJobMemoryStore(), () => new Date(fixedNow));
    await replayOrchestrator.getWorkOrder(actor, "1842");
    await replayOrchestrator.compareParts(actor, { category: "alternator", excludeCheapest: true });
    await replayOrchestrator.createEstimate(actor, {});
    const approval = await replayOrchestrator.requestCustomerApproval(actor);
    await replayOrchestrator.simulateCustomerApproval(actor, "approved", approval.id);
    const window = await replayOrchestrator.getDefaultTomorrowMorning();
    const prepared = await replayOrchestrator.preparePurchaseAndSchedule(actor, { bayId: "bay-2", start: window.start, end: window.end });
    await assert.rejects(
      replayOrchestrator.confirmTransaction(actor, prepared.confirmationToken),
      (error: unknown) => error instanceof FloError && error.code === "UPSTREAM_TIMEOUT"
    );
    await assert.rejects(
      replayOrchestrator.confirmTransaction(actor, prepared.confirmationToken),
      (error: unknown) => error instanceof FloError && error.code === "UPSTREAM_DATA_MISMATCH"
    );
    assert.equal((await adapters.shop.getSchedule({ bayId: "bay-2", from: window.start, to: window.end })).length, 0);
  });

  it("executes each confirmation token as a single in-flight operation", async () => {
    const actor = demoActors.technician;
    let signalOrderStarted = (): void => undefined;
    let releaseOrder = (): void => undefined;
    const orderStarted = new Promise<void>((resolve) => { signalOrderStarted = resolve; });
    const orderRelease = new Promise<void>((resolve) => { releaseOrder = resolve; });
    const delayedSupplier: SupplierAdapter = {
      searchParts: (input) => adapters.supplier.searchParts(input),
      placeOrder: async (input) => {
        signalOrderStarted();
        await orderRelease;
        return adapters.supplier.placeOrder(input);
      },
      getOrderStatus: (reference) => adapters.supplier.getOrderStatus(reference),
      cancelOrder: (id) => adapters.supplier.cancelOrder(id),
      reset: () => adapters.supplier.reset()
    };
    const singleFlightOrchestrator = new FloOrchestrator({ ...adapters, supplier: delayedSupplier }, new InMemoryJobMemoryStore(), () => new Date(fixedNow));
    await singleFlightOrchestrator.getWorkOrder(actor, "1842");
    await singleFlightOrchestrator.compareParts(actor, { category: "alternator", excludeCheapest: true });
    await singleFlightOrchestrator.createEstimate(actor, {});
    const approval = await singleFlightOrchestrator.requestCustomerApproval(actor);
    await singleFlightOrchestrator.simulateCustomerApproval(actor, "approved", approval.id);
    const window = await singleFlightOrchestrator.getDefaultTomorrowMorning();
    const prepared = await singleFlightOrchestrator.preparePurchaseAndSchedule(actor, { bayId: "bay-2", start: window.start, end: window.end });
    const first = singleFlightOrchestrator.confirmTransaction(actor, prepared.confirmationToken);
    await orderStarted;
    await assert.rejects(
      singleFlightOrchestrator.confirmTransaction(actor, prepared.confirmationToken),
      (error: unknown) => error instanceof FloError && error.code === "CONFIRMATION_IN_PROGRESS"
    );
    releaseOrder();
    const completed = await first;
    assert.equal(completed.purchaseOrder.status, "placed");
    assert.equal((await adapters.shop.getSchedule({ bayId: "bay-2", from: window.start, to: window.end })).length, 1);
  });

  it("retires a cancelled order key and permits a safe retry with a new key", async () => {
    const actor = demoActors.technician;
    let failNextSchedule = true;
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
      schedule: async (slot) => {
        if (failNextSchedule) {
          failNextSchedule = false;
          throw new FloError({ code: "SCHEDULE_WRITE_FAILED", message: "The schedule service rejected the write.", retryable: true });
        }
        return adapters.shop.schedule(slot);
      },
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

    await assert.rejects(
      rollbackOrchestrator.confirmTransaction(actor, prepared.confirmationToken),
      (error: unknown) => error instanceof FloError && error.code === "CONFIRMATION_ALREADY_USED"
    );

    const reusedKey = await rollbackOrchestrator.preparePurchaseAndSchedule(actor, { bayId: "bay-2", start: window.start, end: window.end, idempotencyKey });
    await assert.rejects(
      rollbackOrchestrator.confirmTransaction(actor, reusedKey.confirmationToken),
      (error: unknown) => error instanceof FloError && error.code === "IDEMPOTENCY_KEY_RETIRED"
    );
    assert.equal((await adapters.shop.getSchedule({ bayId: "bay-2", from: window.start, to: window.end })).length, 0);

    const freshAttempt = await rollbackOrchestrator.preparePurchaseAndSchedule(actor, { bayId: "bay-2", start: window.start, end: window.end });
    const completed = await rollbackOrchestrator.confirmTransaction(actor, freshAttempt.confirmationToken);
    assert.equal(completed.purchaseOrder.status, "placed");
    assert.equal(completed.purchaseOrder.items[0]?.supplierSku, "PM-ALT-7842");
    assert.equal((await adapters.shop.getSchedule({ bayId: "bay-2", from: window.start, to: window.end })).length, 1);
  });
});
