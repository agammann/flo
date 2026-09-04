import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDemoState } from "@flo/domain";
import { applyMarkup, calculateEstimate } from "./index.js";

describe("estimate engine", () => {
  it("calculates the seeded $219 part with an exact 35 percent markup", () => {
    assert.equal(applyMarkup(21900, 3500), 29565);
  });

  it("calculates money entirely in integer cents", () => {
    const state = createDemoState(new Date("2026-09-03T12:00:00.000Z"));
    const part = state.parts.find((item) => item.id === "part-alt-premium-219")!;
    const offer = state.supplierParts.find((item) => item.supplierId === "supplier-b")!;
    const estimate = calculateEstimate({ id: "estimate-test", workOrderId: "wo-1842", part, offer, now: new Date("2026-09-03T12:00:00.000Z") });
    assert.equal(estimate.partItems[0]?.unitCustomerPriceCents, 29565);
    assert.equal(estimate.laborItems[0]?.totalCents, 12600);
    assert.equal(estimate.subtotalCents, 43365);
    assert.equal(estimate.taxCents, 2538);
    assert.equal(estimate.totalCents, 45903);
    assert.equal(Number.isInteger(estimate.totalCents), true);
  });
});
