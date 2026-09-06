import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDemoState, type Estimate } from "@flo/domain";
import type { ShopAdapter } from "@flo/adapters";
import { FloError } from "@flo/shared-types";
import { CustomerExperience } from "./customer-experience.js";

const owner = { subject: "owner-one", customerId: "customer-001" };
const other = { subject: "owner-two", customerId: "customer-002" };
const fixture = () => {
  const state = createDemoState();
  const work = state.workOrders[0]!;
  const estimate: Estimate = { id: "estimate-owner", workOrderId: work.id, partItems: [{ partId: "private-part", supplierId: "private-supplier", supplierSku: "secret-sku", description: "Replacement alternator", quantity: 1, unitCostCents: 21900, markupBasisPoints: 3500, unitCustomerPriceCents: 29565, lineCostCents: 21900, lineCustomerPriceCents: 29565 }], laborItems: [{ description: "Replacement labor", hours: 1.2, rateCentsPerHour: 10500, totalCents: 12600 }], subtotalCents: 43365, feesCents: 1200, taxCents: 2538, discountCents: 0, totalCents: 45903, taxableSubtotalCents: 30765, shopCostCents: 21900, grossMarginCents: 21465, status: "draft", approvalStatus: "not_requested", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  let estimateReads = 0;
  const shop = {
    listWorkOrders: async () => state.workOrders,
    getWorkOrder: async (number: string) => {
      const found = state.workOrders.find(row => row.workOrderNumber === number);
      if (!found) throw new FloError({ code: "NOT_FOUND", message: "Internal record missing", retryable: false });
      return found;
    },
    getAsset: async () => state.assets[0]!,
    getEstimate: async () => { estimateReads++; return estimate; }
  } as Pick<ShopAdapter, "listWorkOrders" | "getWorkOrder" | "getAsset" | "getEstimate">;
  return { experience: new CustomerExperience(shop as ShopAdapter), state, work, estimate, estimateReads: () => estimateReads };
};

describe("vehicle-owner data boundary", () => {
  it("lists only owned repairs and omits internal fields", async () => {
    const { experience } = fixture();
    const rows = await experience.listRepairs(owner);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.repairNumber, "1842");
    assert.deepEqual(Object.keys(rows[0]).sort(), ["repairNumber", "vehicle", "status", "scheduledStart", "scheduledEnd"].sort());
    assert.doesNotMatch(JSON.stringify(rows), /"(?:vin|customerId|notes|diagnosis|bayId)":|tech-demo/i);
  });
  it("gives the same error for another customer's repair and an unknown repair", async () => {
    const { experience } = fixture();
    for (const number of ["1842", "9999"]) await assert.rejects(experience.getRepair(other, number), error => error instanceof FloError && error.code === "REPAIR_UNAVAILABLE");
  });
  it("checks repair ownership before reading an estimate", async () => {
    const f = fixture(); f.work.estimateId = f.estimate.id;
    await assert.rejects(f.experience.getEstimate(other, "1842"), /not available/);
    assert.equal(f.estimateReads(), 0);
  });
  it("rejects mismatched asset ownership", async () => {
    const f = fixture(); f.state.assets[0]!.customerId = other.customerId;
    await assert.rejects(f.experience.getRepair(owner, "1842"), /not available/);
  });
  it("rejects a cross-job estimate even for an owned repair", async () => {
    const f = fixture(); f.work.estimateId = f.estimate.id; f.estimate.workOrderId = "wo-1843";
    await assert.rejects(f.experience.getEstimate(owner, "1842"), /not available/);
  });
  it("returns exact customer totals without cost, margin or supplier information", async () => {
    const f = fixture(); f.work.estimateId = f.estimate.id;
    const projected = await f.experience.getEstimate(owner, "1842");
    assert.equal(projected.totalCents, 45903);
    assert.equal(projected.subtotalCents - projected.discountCents + projected.taxCents, projected.totalCents);
    assert.equal(projected.parts[0]?.totalCents, 29565);
    assert.doesNotMatch(JSON.stringify(projected), /supplier|sku|markup|margin|costCents|private-part/i);
  });
  it("explains that an estimate is not ready without inventing a price", async () => {
    await assert.rejects(fixture().experience.getEstimate(owner, "1842"), error => error instanceof FloError && error.code === "ESTIMATE_NOT_READY");
  });
  it("rejects an empty trusted identity", async () => {
    await assert.rejects(fixture().experience.listRepairs({ subject: "", customerId: "" }), /not available/);
  });
});
