import assert from "node:assert/strict";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import type { Express } from "express";
import { createHttpAdapters } from "@flo/adapters";
import type { AdapterSet } from "@flo/adapters";
import { FloError } from "@flo/shared-types";
import { CustomerWebsiteAuth, FloOrchestrator, InMemoryJobMemoryStore, type CustomerRepair } from "@flo/agent";
import { demoActors } from "@flo/domain";
import { createCustomerWebsite } from "@flo/mcp";
import { createShopApi } from "@flo/mock-shop-api";
import { createInventoryApi } from "@flo/mock-inventory-api";
import { createSupplierApi } from "@flo/mock-supplier-api";
import { createCustomerApi } from "@flo/mock-customer-api";

const fixedNow = new Date("2026-09-03T12:00:00.000Z");
const clock = (): Date => new Date(fixedNow);

const listen = async (app: Express | Server): Promise<{ server: Server; url: string }> => new Promise((resolve, reject) => {
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

const close = async (server: Server): Promise<void> => new Promise((resolve, reject) => server.close((error) => error === undefined ? resolve() : reject(error)));

describe("Flo end-to-end demo workflow", () => {
  const servers: Server[] = [];
  let orchestrator: FloOrchestrator;
  let memory: InMemoryJobMemoryStore;
  let adapters: AdapterSet;

  before(async () => {
    const [shop, inventory, supplier, customer] = await Promise.all([
      listen(createShopApi(fixedNow).app),
      listen(createInventoryApi(fixedNow).app),
      listen(createSupplierApi(fixedNow).app),
      listen(createCustomerApi(fixedNow).app)
    ]);
    servers.push(shop.server, inventory.server, supplier.server, customer.server);
    adapters = createHttpAdapters({ shop: shop.url, inventory: inventory.url, supplier: supplier.url, customer: customer.url });
    memory = new InMemoryJobMemoryStore();
    orchestrator = new FloOrchestrator(adapters, memory, clock);
  });

  after(async () => { await Promise.all(servers.map(close)); });

  it("ranks explicit gross part profit by deterministic cents, independently of the balanced recommendation", async () => {
    const input = { workOrderIdOrNumber: "1842", category: "alternator", maximumLandedCostCents: 30000, latestDeliveryDate: "2026-09-04", excludeCheapest: true };
    const balanced = await orchestrator.compareParts(demoActors.technician, input);
    const profit = await orchestrator.compareParts(demoActors.technician, { ...input, ranking: "gross_part_margin" });
    assert.equal(balanced.recommendation?.grossPartMarginCents, 7665);
    assert.equal(profit.recommendation?.grossPartMarginCents, 10115);
    assert.equal(profit.recommendation?.landedCostCents, 28900);
    assert.notEqual(profit.recommendation?.offer.supplierSku, balanced.recommendation?.offer.supplierSku);
    assert.deepEqual(profit.ranked.map(item => item.grossPartMarginCents), [...profit.ranked.map(item => item.grossPartMarginCents)].sort((a, b) => b - a));
    assert.ok(profit.ranked.every(item => item.landedCostCents <= 30000 && item.offer.deliveryDate <= "2026-09-04"));
  });

  it("executes work order, diagnosis, parts, estimate, approval, memory, purchase, and scheduling", async (context) => {
    const actor = demoActors.technician;
    const opened = await orchestrator.getWorkOrder(actor, "1842");
    assert.equal(opened.assetId, "asset-f150-2019");

    const diagnostic = await orchestrator.recordDiagnostic(actor, "Alternator failed.");
    assert.match(diagnostic.finding, /alternator failed/i);

    const parts = await orchestrator.findCompatibleParts(actor, {
      category: "alternator",
      maximumLandedCostCents: 30000,
      latestDeliveryDate: "2026-09-04",
      excludeCheapest: true
    });
    assert.equal(parts.compatibility.filter((item) => item.compatible).length, 3);
    assert.equal(parts.recommendation?.offer.supplierId, "supplier-b");
    assert.equal(parts.recommendation?.part.partNumber, "ALT-7842");
    assert.equal(parts.recommendation?.landedCostCents, 21900);
    assert.equal(parts.recommendation?.customerPriceCents, 29565);
    assert.equal(parts.recommendation?.grossPartMarginCents, 7665);

    const estimate = await orchestrator.createEstimate(actor, {});
    assert.equal(estimate.totalCents, 45903);
    const approval = await orchestrator.requestCustomerApproval(actor);
    assert.equal(approval.status, "pending");
    await orchestrator.simulateCustomerApproval(actor, "approved", approval.id);

    const resumedAgent = new FloOrchestrator(
      // Reusing the same service adapters and long-term memory emulates a fresh conversational session.
      adapters,
      memory,
      clock
    );
    const status = await resumedAgent.getJobStatus(actor, "Ford");
    assert.equal(status.workOrder.workOrderNumber, "1842");
    assert.equal(status.approval?.status, "approved");

    const slot = await resumedAgent.getDefaultTomorrowMorning();
    const prepared = await resumedAgent.preparePurchaseAndSchedule(actor, {
      bayId: "bay-2",
      start: slot.start,
      end: slot.end
    });
    assert.equal(prepared.requiresConfirmation, true);
    assert.match(prepared.summary, /No action has been executed/);

    const result = await resumedAgent.confirmTransaction(actor, prepared.confirmationToken);
    assert.equal(result.purchaseOrder.status, "placed");
    assert.equal(result.scheduleSlot.bayId, "bay-2");
    assert.equal(result.workOrder.status, "scheduled");
    assert.equal(result.auditLogIds.length, 2);

    await assert.rejects(
      resumedAgent.confirmTransaction(actor, prepared.confirmationToken),
      (error: unknown) => error instanceof FloError && error.code === "CONFIRMATION_ALREADY_USED"
    );

    await context.test("only the linked owner can see scheduled repair 1842 and its appointment", async (appointmentTest) => {
      const publicOrigin = "https://flo.example";
      const links = new Map([["repair-owner", "customer-001"], ["other-owner", "customer-002"]]);
      const auth = new CustomerWebsiteAuth(
        { clientId: "appointment-test", clientSecret: "synthetic-test-only", publicOrigin },
        { exchange: async code => ({ accessToken: code, subject: code, expiresIn: 60 }), subject: async token => token },
        { findCustomer: async (_client, subject) => links.get(subject) },
        () => fixedNow.getTime()
      );
      const site = await listen(createCustomerWebsite({ auth, shop: adapters.shop }));
      appointmentTest.after(() => close(site.server));

      // Use Flo's session logic with a simulated Amazon provider, without an external redirect.
      const signIn = async (subject: string): Promise<string> => {
        const { authorizationUrl, browserNonce } = auth.begin("127.0.0.1");
        const state = new URL(authorizationUrl).searchParams.get("state");
        assert.ok(state);
        return `__Host-flo-session=${await auth.finish(state, browserNonce, subject)}`;
      };
      const ask = async (cookie: string, command: string) => {
        const response = await fetch(`${site.url}/api/customer/command`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: publicOrigin, Cookie: cookie },
          body: JSON.stringify({ command })
        });
        assert.equal(response.status, 200);
        return await response.json() as { ok: boolean; voice: string; tools: string[]; data: { data: CustomerRepair | CustomerRepair[] } | null };
      };

      const owner = await signIn("repair-owner");
      const ownerView = await ask(owner, "Show repair 1842");
      assert.equal(ownerView.ok, true);
      assert.deepEqual(ownerView.tools, ["get_my_repair"]);
      const ownerRepair = ownerView.data?.data;
      assert.ok(ownerRepair && !Array.isArray(ownerRepair));
      assert.equal(ownerRepair.repairNumber, "1842");
      assert.equal(ownerRepair.status, "scheduled");
      assert.equal(ownerRepair.scheduledStart, slot.start);
      assert.equal(ownerRepair.scheduledEnd, slot.end);
      assert.match(ownerView.voice, /repair 1842: scheduled\. Service starts .* UTC and ends .* UTC\./);

      const other = await signIn("other-owner");
      const otherList = await ask(other, "Show my repairs");
      assert.equal(otherList.ok, true);
      const listedRepairs = otherList.data?.data;
      assert.ok(Array.isArray(listedRepairs));
      assert.deepEqual(listedRepairs.map(repair => repair.repairNumber), ["1843"]);

      const denied = await ask(other, "Show repair 1842");
      assert.equal(denied.ok, false);
      assert.equal(denied.data, null);
      assert.match(denied.voice, /not available for your account/);
      assert.deepEqual(denied, await ask(other, "Show repair 9999"));
      const otherResponses = JSON.stringify([otherList, denied]);
      assert.doesNotMatch(otherResponses, /1842|F-150|UTC/i);
      assert.ok(!otherResponses.includes(slot.start) && !otherResponses.includes(slot.end));
    });
  });
});
