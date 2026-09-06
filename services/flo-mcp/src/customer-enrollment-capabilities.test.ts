import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, type TransactWriteCommandInput } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { enrollmentIdentityKey, CustomerEnrollmentApproval } from "./customer-enrollment.js";
import { DynamoEnrollmentStarter } from "./customer-enrollment-dynamodb-start.js";
import { DynamoEnrollmentApprover, DynamoDesignatedEnrollmentApprover } from "./customer-enrollment-dynamodb-approve.js";
import { DynamoEnrollmentRedeemer } from "./customer-enrollment-dynamodb-redeem.js";

const tables = { auth: "test-auth", requests: "test-requests", approvals: "test-approvals", links: "test-links", audit: "test-audit" };
const now = Date.parse("2026-09-05T12:00:00Z");
const proof = { clientId: "test-client", amazonUserId: "test-subject", sessionKey: "test-session", revision: "test-session-revision", expiresAt: now + 600_000 };
const pending = { id: "a".repeat(64), identityKey: enrollmentIdentityKey(proof), proof, expiresAt: now + 300_000, status: "pending" as const };
const row = { ...pending, revision: "00000000-0000-4000-8000-000000000001", ttl: Math.ceil(pending.expiresAt / 1000), purpose: "fictional_customer_pairing" };
const approval = { customerId: "staging-customer-a", operatorId: "test-operator", approvedAt: new Date(now).toISOString(), invitationHash: "b".repeat(64), verification: { mode: "synthetic_test_designation" as const, evidenceRef: "independent-test-designation" } };

// SDK-command contract capture only; real condition/race execution is covered
// separately in DynamoDB Local. This is not an IAM simulator.
function fixture() {
  const base = new DynamoDBClient({ region: "us-west-2", credentials: { accessKeyId: "LOCALTESTONLY", secretAccessKey: "LOCALTESTONLY" } });
  const client = DynamoDBDocumentClient.from(base);
  const stored = new Map<string, Record<string, unknown>>([[tables.requests, row], [tables.approvals, { ...row, status: "approved", approval }]]);
  const writes: TransactWriteCommandInput[] = [];
  client.middlewareStack.add((_next, context) => async args => {
    if (context.commandName === "GetItemCommand") {
      const input = z.object({ TableName: z.string(), ConsistentRead: z.literal(true) }).parse(args.input);
      return { response: {}, output: { $metadata: {}, Item: structuredClone(stored.get(input.TableName)) } };
    }
    assert.equal(context.commandName, "TransactWriteItemsCommand");
    writes.push(structuredClone(args.input) as TransactWriteCommandInput);
    return { response: {}, output: { $metadata: {} } };
  }, { step: "initialize", name: "enrollmentContract", priority: "high" });
  return { client, stored, writes, close: () => base.destroy() };
}
describe("separated enrollment authority (SDK command contracts, not deployed IAM)", () => {
  it("fixed-identity adapter rejects another Amazon identity before transaction and binds accepted identity at commit", async () => {
    const f = fixture();
    try {
      const denied = new DynamoDesignatedEnrollmentApprover(f.client, tables, "f".repeat(64), () => now);
      assert.equal(await denied.approve(row.id, approval), false); assert.equal(f.writes.length, 0);
      const allowed = new DynamoDesignatedEnrollmentApprover(f.client, tables, row.identityKey, () => now);
      assert.equal(await allowed.approve(row.id, approval), true);
      const guard = f.writes[0]!.TransactItems!.find(item => item.ConditionCheck?.TableName === tables.requests)!.ConditionCheck!;
      assert.equal(guard.ExpressionAttributeValues?.[":identity"], row.identityKey);
      assert.deepEqual(guard.ExpressionAttributeValues?.[":proof"], proof);
      assert.throws(() => new DynamoDesignatedEnrollmentApprover(f.client, tables, "invalid"));
    } finally { f.close(); }
  });
  it("has single-purpose adapters and rejects shared approval/request storage", () => {
    const f = fixture();
    try {
      const start = new DynamoEnrollmentStarter(f.client, tables);
      const approve = new DynamoEnrollmentApprover(f.client, tables);
      const redeem = new DynamoEnrollmentRedeemer(f.client, tables);
      assert.equal("approve" in start, false); assert.equal("redeem" in start, false);
      assert.equal("start" in approve, false); assert.equal("redeem" in approve, false);
      assert.equal("approve" in redeem, false); assert.equal("start" in redeem, false);
      assert.throws(() => new DynamoEnrollmentStarter(f.client, { ...tables, approvals: tables.requests }), /distinct/);
    } finally { f.close(); }
  });
  it("starts requests without writing approval, link or audit stores", async () => {
    const f = fixture();
    try {
      assert.equal(await new DynamoEnrollmentStarter(f.client, tables, () => now).start(pending), true);
      for (const item of f.writes[0]!.TransactItems!) {
        const write = item.Put ?? item.Update ?? item.Delete;
        if (write) assert.equal(write.TableName, tables.requests);
      }
    } finally { f.close(); }
  });
  it("operator writes a protected snapshot and audit without mutating requests or links", async () => {
    const f = fixture();
    try {
      assert.equal(await new DynamoEnrollmentApprover(f.client, tables, () => now).approve(row.id, approval), true);
      const actions = f.writes[0]!.TransactItems!;
      assert.deepEqual(actions.filter(item => item.Put).map(item => item.Put!.TableName).sort(), [tables.approvals, tables.audit].sort());
      assert.equal(actions.some(item => item.Update || item.Delete), false);
      assert.deepEqual(actions.find(item => item.Put?.TableName === tables.approvals)?.Put?.Item, { ...row, status: "approved", approval });
      assert.match(actions.find(item => item.ConditionCheck?.TableName === tables.requests)!.ConditionCheck!.ConditionExpression!, /proof = :proof.*expiresAt = :expires/);
    } finally { f.close(); }
  });
  it("redemption checks the entire approval snapshot at commit and never writes it", async () => {
    const f = fixture();
    try {
      assert.equal(await new DynamoEnrollmentRedeemer(f.client, tables, () => now).redeem(row.id, approval.invitationHash, proof), true);
      const actions = f.writes[0]!.TransactItems!;
      const guard = actions.find(item => item.ConditionCheck?.TableName === tables.approvals)!.ConditionCheck!;
      assert.deepEqual(guard.ExpressionAttributeValues?.[":approval"], approval);
      assert.deepEqual(guard.ExpressionAttributeValues?.[":proof"], proof);
      assert.equal(guard.ExpressionAttributeValues?.[":expires"], row.expiresAt);
      for (const item of actions) {
        const write = item.Put ?? item.Update ?? item.Delete;
        if (write) assert.notEqual(write.TableName, tables.approvals);
      }
      const link = actions.find(item => item.Put?.TableName === tables.links)!.Put!;
      assert.equal(link.Item?.customerId, "staging-customer-a");
      assert.equal(link.ConditionExpression, "attribute_not_exists(id)");
    } finally { f.close(); }
  });
  it("ignores forged request approvals, mismatched snapshot IDs and wrong invitations", async () => {
    const f = fixture();
    try {
      const redeemer = new DynamoEnrollmentRedeemer(f.client, tables, () => now);
      f.stored.delete(tables.approvals);
      f.stored.set(tables.requests, { ...row, status: "approved", approval });
      assert.equal(await redeemer.redeem(row.id, approval.invitationHash, proof), false);
      f.stored.set(tables.approvals, { ...row, id: "c".repeat(64), status: "approved", approval });
      assert.equal(await redeemer.redeem(row.id, approval.invitationHash, proof), false);
      f.stored.set(tables.approvals, { ...row, status: "approved", approval });
      assert.equal(await redeemer.redeem(row.id, "d".repeat(64), proof), false);
      assert.equal(f.writes.length, 0);
    } finally { f.close(); }
  });
  it("private approval service needs no link-write capability and denies customer B", async () => {
    let called = 0;
    const service = new CustomerEnrollmentApproval({ approve: async () => { called++; return true; } }, async () => ({ id: "test-operator", allowedCustomerIds: ["staging-customer-a"] }), () => now);
    const input = { requestCode: "r".repeat(43), customerId: "staging-customer-b", verification: approval.verification };
    await assert.rejects(service.approve("", input)); assert.equal(called, 0);
    assert.equal((await service.approve("", { ...input, customerId: "staging-customer-a" })).status, "operator_approved");
    assert.equal(called, 1);
  });
});
