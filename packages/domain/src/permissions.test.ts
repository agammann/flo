import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FloError, type Actor } from "@flo/shared-types";
import { canReadWorkOrder, hasPermission, requirePermission, requireWorkOrderRead } from "./permissions.js";

const unassignedTechnician: Actor = {
  id: "tech-unassigned",
  displayName: "Unassigned Technician",
  role: "technician",
  assignedWorkOrderIds: []
};

describe("role and work-order permissions", () => {
  it("limits a technician to assigned work orders", () => {
    assert.equal(canReadWorkOrder(unassignedTechnician, "wo-1842"), false);
    assert.throws(
      () => requireWorkOrderRead(unassignedTechnician, "wo-1842"),
      (error: unknown) => error instanceof FloError && error.code === "WORK_ORDER_ACCESS_DENIED"
    );
  });

  it("allows managers to read audits and rejects administrator-only configuration changes", () => {
    const manager: Actor = { id: "manager-1", displayName: "Manager", role: "manager", assignedWorkOrderIds: [] };
    assert.equal(hasPermission(manager, "audit:read"), true);
    assert.equal(hasPermission(manager, "configuration:write"), false);
    assert.throws(
      () => requirePermission(manager, "configuration:write"),
      (error: unknown) => error instanceof FloError && error.code === "PERMISSION_DENIED"
    );
  });
});
