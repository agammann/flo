/* global Request */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { repairProjectionSchema, DynamoCustomerRepairs } from "../services/flo-mcp/dist/customer-dynamodb.js";
import { createCustomerHttp } from "../services/flo-mcp/dist/customer-http.js";
import { CustomerAuthError } from "../packages/agent/dist/index.js";

const plan = JSON.parse(readFileSync(new URL("../docs/verification/customer-repair-fixture-plan-2026-09-08.json", import.meta.url), "utf8"));

test("review-only fixture contains exactly two matching, minimal customer projections", () => {
  assert.equal(plan.status, "REVIEW_ONLY_NOT_EXECUTED");
  assert.equal(plan.operation, "TransactWriteItems");
  assert.equal(plan.conditionOnEachPut, "attribute_not_exists(pk) AND attribute_not_exists(sk)");
  assert.equal(plan.returnValuesOnConditionCheckFailure, "NONE");
  assert.equal(plan.records.length, 2);
  for (const [index, row] of plan.records.entries()) {
    assert.deepEqual(repairProjectionSchema.parse(row), row);
    assert.equal(row.customerId, index === 0 ? "staging-customer-a" : "staging-customer-b");
    assert.equal(row.pk, "customer#" + row.customerId);
    assert.equal(row.sk, "repair#" + row.repair.repairNumber);
    assert.equal(row.repair.repairNumber, index === 0 ? "1842" : "2842");
    assert.match(row.repair.vehicle, /^Fictional /);
    assert.equal(row.estimate, null);
    assert.equal(row.repair.scheduledStart, null);
    assert.equal(row.repair.scheduledEnd, null);
  }
});

test("offline real HTTP/MCP boundary accepts A, hides B and rejects missing/service-only sessions", async () => {
  const sent = [];
  // Command fake only: no AWS client, credentials, listener or network. Live
  // DynamoDB condition/transaction behavior is not claimed by this test.
  const client = { send: async command => {
    const kind = command.constructor.name; const input = command.input;
    sent.push(kind);
    assert.equal(input.TableName, plan.tableName);
    assert.equal(input.ConsistentRead, true);
    if (kind === "QueryCommand") return { Items: plan.records.filter(row => row.pk === input.ExpressionAttributeValues[":pk"]) };
    assert.equal(kind, "GetCommand", "only reads may occur in the offline fixture check");
    return { Item: plan.records.find(row => row.pk === input.Key.pk && row.sk === input.Key.sk) };
  } };
  const origin = "https://fixture.invalid";
  const session = "a".repeat(43);
  const auth = { config: { publicOrigin: origin }, principal: async value => {
    if (value !== session) throw new CustomerAuthError(401, "SIGN_IN_REQUIRED");
    return { subject: "synthetic-test-subject", customerId: "staging-customer-a" };
  } };
  const handle = createCustomerHttp({ auth, experience: new DynamoCustomerRepairs(client, plan.tableName) });
  const call = async (command, authenticated = true, extra = {}) => {
    const headers = { origin, "content-type": "application/json", ...extra };
    if (authenticated) headers.cookie = "__Host-flo-session=" + session;
    const response = await handle(new Request(origin + "/api/customer/command", { method: "POST", headers, body: JSON.stringify({ command }) }), "192.0.2.10");
    return { status: response.status, body: await response.json() };
  };
  const list = await call("List my repairs");
  assert.equal(list.status, 200); assert.equal(list.body.ok, true);
  assert.deepEqual(list.body.tools, ["list_my_repairs"]);
  assert.deepEqual(list.body.data.data, [plan.records[0].repair]);
  const own = await call("Show repair 1842");
  assert.equal(own.body.ok, true); assert.deepEqual(own.body.tools, ["get_my_repair"]);
  assert.deepEqual(own.body.data.data, plan.records[0].repair);
  const denied = await call("Show repair 2842");
  assert.equal(denied.body.ok, false); assert.equal(denied.body.data, null);
  assert.deepEqual(denied, await call("Show repair 9999"));
  const estimate = await call("Show estimate 1842");
  assert.equal(estimate.body.ok, false); assert.deepEqual(estimate.body.tools, ["get_my_estimate"]);
  assert.match(estimate.body.voice, /not prepared an estimate/);
  assert.deepEqual(await call("Show estimate 2842"), await call("Show estimate 9999"));
  const before = sent.length;
  assert.equal((await call("List my repairs", false)).status, 401);
  assert.equal((await call("List my repairs", false, { authorization: "Bearer synthetic-service-only", "x-flo-customer-id": "staging-customer-a" })).status, 401);
  assert.equal(sent.length, before, "rejected identities cannot query repair storage");
});
