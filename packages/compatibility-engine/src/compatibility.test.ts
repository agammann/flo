import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDemoState } from "@flo/domain";
import { checkCompatibility, rankSupplierOptions } from "./index.js";

describe("compatibility engine", () => {
  it("matches the three seeded Ford alternators and rejects the Chevrolet part", () => {
    const state = createDemoState(new Date("2026-09-03T12:00:00.000Z"));
    const asset = state.assets.find((item) => item.id === "asset-f150-2019");
    assert.ok(asset);
    const results = state.parts.map((part) => checkCompatibility(asset, part));
    assert.equal(results.filter((result) => result.status === "compatible").length, 3);
    assert.deepEqual(results.find((result) => result.partNumber === "ALT-GM-220") && {
      status: results.find((result) => result.partNumber === "ALT-GM-220")?.status,
      reasonCode: results.find((result) => result.partNumber === "ALT-GM-220")?.reasonCode
    }, {
      status: "incompatible",
      reasonCode: "NO_MATCHING_RULE"
    });
  });

  it("recommends the premium Supplier B offer when the cheapest option is excluded", () => {
    const state = createDemoState(new Date("2026-09-03T12:00:00.000Z"));
    const compatibleIds = new Set(
      state.parts
        .filter((part) => checkCompatibility(state.assets[0]!, part).compatible)
        .map((part) => part.id)
    );
    const ranked = rankSupplierOptions({
      offers: state.supplierParts.filter((offer) => compatibleIds.has(offer.partId)),
      parts: state.parts,
      suppliers: state.suppliers,
      latestDeliveryDate: "2026-09-04",
      maximumLandedCostCents: 30000,
      excludeCheapest: true
    });
    assert.equal(ranked[0]?.offer.supplierId, "supplier-b");
    assert.equal(ranked[0]?.part.partNumber, "ALT-7842");
  });
});
