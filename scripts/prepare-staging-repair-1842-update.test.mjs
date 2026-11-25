/* global Request, structuredClone */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CustomerAuthError } from "../packages/agent/dist/index.js";
import { createDemoState } from "../packages/domain/dist/index.js";
import { DynamoCustomerRepairs, repairProjectionSchema } from "../services/flo-mcp/dist/customer-dynamodb.js";
import { createCustomerHttp } from "../services/flo-mcp/dist/customer-http.js";
import { prepareStagingRepair1842Update } from "./prepare-staging-repair-1842-update.mjs";

const fixtures = JSON.parse(readFileSync(new URL("../docs/verification/customer-repair-fixture-plan-2026-09-08.json", import.meta.url), "utf8"));
const [repairA, repairB] = fixtures.records;
const now = new Date("2026-11-24T20:00:00.000Z");
const start = "2026-11-25T17:00:00.000Z";
const end = "2026-11-25T19:00:00.000Z";

function confirmedLocalAppointment() {
  const workOrder = createDemoState(now).workOrders.find(row => row.workOrderNumber === "1842");
  assert.ok(workOrder);
  return {
    workOrder: { ...workOrder, status: "scheduled", bayId: "bay-2", scheduledStart: start, scheduledEnd: end },
    scheduleSlot: { id: "local-slot", workOrderId: workOrder.id, bayId: "bay-2", start, end, technicianId: "local-technician" },
    purchaseOrder: {
      id: "local-alternator-order", workOrderId: workOrder.id, status: "placed", supplierId: "local-supplier", totalCents: 21900,
      items: [{ partId: "local-part", supplierSku: "local-supplier-sku", quantity: 1, unitCostCents: 21900 }],
      idempotencyKey: "local-test-only", createdAt: now.toISOString()
    },
    auditLogIds: ["local-audit-order", "local-audit-schedule"],
    summary: "Local order and schedule confirmed."
  };
}

test("review plan binds one conditional update to the exact staged fictional record", () => {
  const confirmation = confirmedLocalAppointment();
  const plan = prepareStagingRepair1842Update(confirmation);
  assert.equal(plan.status, "REVIEW_ONLY_NOT_EXECUTED");
  assert.deepEqual(plan.target, {
    account: fixtures.account, region: fixtures.region, stack: fixtures.stack, logicalResource: fixtures.logicalResource
  });
  assert.deepEqual(plan.expectedBefore, repairA);
  assert.deepEqual(plan.expectedAfter, {
    ...repairA, repair: { ...repairA.repair, status: "scheduled", scheduledStart: start, scheduledEnd: end }
  });
  assert.deepEqual(repairProjectionSchema.parse(plan.expectedAfter), plan.expectedAfter);
  assert.equal(confirmation.workOrder.customerId, "customer-001");
  assert.doesNotMatch(JSON.stringify(plan), /local-supplier|local-audit|local-alternator-order|local-technician|2842/);

  const request = plan.request;
  assert.equal(request.TableName, fixtures.tableName);
  assert.deepEqual(request.Key, { pk: { S: repairA.pk }, sk: { S: repairA.sk } });
  assert.equal(request.ReturnValues, "NONE");
  assert.equal(request.ReturnValuesOnConditionCheckFailure, "NONE");
  const expandNames = expression => expression.replace(/#[A-Za-z0-9_]+/g, alias => {
    const name = request.ExpressionAttributeNames[alias];
    assert.ok(name, `missing name ${alias}`);
    return name;
  });
  function comparisonValues(expressions) {
    return Object.fromEntries(expressions.map(expression => {
      const match = /^([\w.]+)\s*=\s*(:\w+)$/.exec(expression.trim());
      assert.ok(match, `unexpected expression ${expression}`);
      const value = request.ExpressionAttributeValues[match[2]];
      assert.ok(value, `missing value ${match[2]}`);
      return [match[1], value];
    }));
  }

  const update = expandNames(request.UpdateExpression);
  assert.match(update, /^SET\s+/);
  assert.deepEqual(comparisonValues(update.replace(/^SET\s+/, "").split(",")), {
    "repair.status": { S: "scheduled" },
    "repair.scheduledStart": { S: start },
    "repair.scheduledEnd": { S: end }
  });

  const conditions = expandNames(request.ConditionExpression).split(/\s+AND\s+/);
  const existenceChecks = conditions.filter(condition => condition.startsWith("attribute_exists"));
  assert.deepEqual(existenceChecks.sort(), ["attribute_exists(pk)", "attribute_exists(sk)"]);
  assert.deepEqual(comparisonValues(conditions.filter(condition => !existenceChecks.includes(condition))), {
    customerId: { S: repairA.customerId },
    repair: { M: {
      repairNumber: { S: "1842" }, vehicle: { S: repairA.repair.vehicle }, status: { S: "diagnosis" },
      scheduledStart: { NULL: true }, scheduledEnd: { NULL: true }
    } },
    estimate: { NULL: true }
  });
});

test("refuses unconfirmed, inconsistent, and out-of-scope local results", () => {
  const cases = [
    ["wrong shop customer", result => { result.workOrder.customerId = "customer-002"; }],
    ["wrong repair number", result => { result.workOrder.workOrderNumber = "1843"; }],
    ["wrong work order", result => { result.workOrder.id = "wo-1843"; }],
    ["unscheduled work order", result => { result.workOrder.status = "approved"; }],
    ["wrong bay", result => { result.workOrder.bayId = result.scheduleSlot.bayId = "bay-1"; }],
    ["unrelated slot", result => { result.scheduleSlot.workOrderId = "wo-1843"; }],
    ["unrelated purchase", result => { result.purchaseOrder.workOrderId = "wo-1843"; }],
    ["unplaced purchase", result => { result.purchaseOrder.status = "cancelled"; }],
    ["different schedule timestamps", result => { result.scheduleSlot.end = "2026-11-25T20:00:00.000Z"; }],
    ["reversed schedule", result => { result.workOrder.scheduledEnd = result.scheduleSlot.end = "2026-11-25T16:00:00.000Z"; }],
    ["non-UTC schedule", result => { result.workOrder.scheduledStart = result.scheduleSlot.start = "2026-11-25T09:00:00.000-08:00"; }],
    ["invalid calendar day", result => { result.workOrder.scheduledStart = result.scheduleSlot.start = "2026-11-31T17:00:00.000Z"; }],
    ["duplicate audits", result => { result.auditLogIds = ["same", "same"]; }],
    ["missing audit", result => { result.auditLogIds = ["local-audit-order"]; }],
    ["empty audit ID", result => { result.auditLogIds[1] = ""; }]
  ];
  for (const [label, change] of cases) {
    const confirmation = confirmedLocalAppointment();
    change(confirmation);
    assert.throws(() => prepareStagingRepair1842Update(confirmation), label);
  }
  assert.throws(() => prepareStagingRepair1842Update({ requiresConfirmation: true }));
});

test("CLI accepts a successful shop response and rejects an unsuccessful confirmation trace", context => {
  const folder = mkdtempSync(join(tmpdir(), "flo-staging-repair-test-"));
  const input = join(folder, "confirm.json");
  const program = fileURLToPath(new URL("./prepare-staging-repair-1842-update.mjs", import.meta.url));
  context.after(() => { unlinkSync(input); rmdirSync(folder); });
  const data = confirmedLocalAppointment();
  const response = {
    ok: true, view: "schedule", voice: data.summary, data,
    invocations: [{ tool: "confirm_transaction", ok: true, durationMs: 1, kind: "mcp", arguments: { confirmationToken: "local-fixture-token" } }]
  };
  writeFileSync(input, JSON.stringify(response), "utf8");
  const prepared = spawnSync(process.execPath, [program, input], { encoding: "utf8" });
  assert.equal(prepared.status, 0, prepared.stderr);
  assert.deepEqual(JSON.parse(prepared.stdout), prepareStagingRepair1842Update(data));
  assert.doesNotMatch(prepared.stdout, /local-fixture-token/);

  response.invocations[0].ok = false;
  writeFileSync(input, JSON.stringify(response), "utf8");
  const rejected = spawnSync(process.execPath, [program, input], { encoding: "utf8" });
  assert.equal(rejected.status, 1);
  assert.equal(rejected.stdout, "");
  assert.match(rejected.stderr, /successful Confirm/i);
});

test("offline hosted read path renders the new appointment to A and hides it from B", async () => {
  const plan = prepareStagingRepair1842Update(confirmedLocalAppointment());
  const rows = [structuredClone(plan.expectedBefore), structuredClone(repairB)];
  // Use the production hosted read adapter. The fake does not interpret or execute UpdateItem.
  const database = { send: async command => {
    const input = command.input;
    assert.equal(input.TableName, fixtures.tableName);
    assert.equal(input.ConsistentRead, true);
    if (command.constructor.name === "QueryCommand") {
      return { Items: rows.filter(row => row.pk === input.ExpressionAttributeValues[":pk"]) };
    }
    assert.equal(command.constructor.name, "GetCommand");
    return { Item: rows.find(row => row.pk === input.Key.pk && row.sk === input.Key.sk) };
  } };
  const origin = "https://fixture.invalid";
  const sessionA = "a".repeat(43);
  const sessionB = "b".repeat(43);
  const sessions = new Map([[sessionA, repairA.customerId], [sessionB, repairB.customerId]]);
  const auth = { config: { publicOrigin: origin }, principal: async session => {
    const customerId = sessions.get(session);
    if (!customerId) throw new CustomerAuthError(401, "SIGN_IN_REQUIRED");
    return { subject: `fictional-${customerId}`, customerId };
  } };
  const handle = createCustomerHttp({ auth, experience: new DynamoCustomerRepairs(database, fixtures.tableName) });
  const ask = async (session, command) => {
    const response = await handle(new Request(`${origin}/api/customer/command`, {
      method: "POST", headers: { origin, "content-type": "application/json", cookie: `__Host-flo-session=${session}` },
      body: JSON.stringify({ command })
    }), "192.0.2.10");
    assert.equal(response.status, 200);
    return response.json();
  };

  const before = await ask(sessionA, "Show repair 1842");
  assert.deepEqual(before.data.data, repairA.repair);
  assert.match(before.voice, /No service time is scheduled yet/);
  rows[0] = structuredClone(plan.expectedAfter);

  const owner = await ask(sessionA, "Show repair 1842");
  assert.equal(owner.ok, true);
  assert.deepEqual(owner.data.data, plan.expectedAfter.repair);
  assert.deepEqual(owner.tools, ["get_my_repair"]);
  assert.match(owner.voice, /repair 1842: scheduled\. Service starts .*5:00 PM UTC and ends .*7:00 PM UTC/);
  const estimate = await ask(sessionA, "Show estimate 1842");
  assert.equal(estimate.data, null);
  assert.match(estimate.voice, /not prepared an estimate/);

  const other = await ask(sessionB, "List my repairs");
  assert.deepEqual(other.data.data, [repairB.repair]);
  const foreign = await ask(sessionB, "Show repair 1842");
  assert.equal(foreign.ok, false);
  assert.equal(foreign.data, null);
  assert.deepEqual(foreign, await ask(sessionB, "Show repair 9999"));
  assert.doesNotMatch(JSON.stringify([other, foreign]), /1842|Ford F-150|2026-11-25|5:00 PM UTC|7:00 PM UTC/);
});
