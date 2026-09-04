import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { demoActors } from "@flo/domain";
import type { AdapterSet } from "@flo/adapters";
import { FloOrchestrator } from "./index.js";

describe("orchestrator authorization", () => {
  it("requires an adapter-backed work order and does not invent state", async () => {
    const adapters = {
      shop: { getWorkOrder: async () => { throw new Error("source unavailable"); } }
    } as unknown as AdapterSet;
    const orchestrator = new FloOrchestrator(adapters);
    await assert.rejects(orchestrator.getWorkOrder(demoActors.technician, "1842"), /source unavailable/);
  });
});
