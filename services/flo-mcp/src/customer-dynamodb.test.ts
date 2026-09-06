import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { customerLinkKey, DynamoAuthStore, DynamoCustomerLinkStore, DynamoCustomerRepairs } from "./customer-dynamodb.js";

// SDK-command contract fake, not a live DynamoDB service. Local-DynamoDB tests are separate.
const fixture = () => {
  const rows = new Map<string, Record<string, unknown>>();
  const commands: { name: string; input: unknown }[] = [];
  const base = new DynamoDBClient({ region: "us-west-2" }); const client = DynamoDBDocumentClient.from(base);
  client.middlewareStack.add((_next, context) => async args => {
    commands.push({ name: context.commandName ?? "", input: structuredClone(args.input) });
    const input = z.object({ TableName: z.string(), Key: z.record(z.string(), z.unknown()).optional(), Item: z.record(z.string(), z.unknown()).optional(), ExpressionAttributeValues: z.record(z.string(), z.unknown()).optional() }).parse(args.input);
    const key = JSON.stringify([input.TableName, input.Key ?? { id: input.Item?.id }]);
    if (context.commandName === "GetItemCommand") return { response: {}, output: { $metadata: {}, Item: structuredClone(rows.get(key)) } };
    if (context.commandName === "DeleteItemCommand") { rows.delete(key); return { response: {}, output: { $metadata: {} } }; }
    if (context.commandName === "PutItemCommand") {
      if (rows.get(key)?.revision !== input.ExpressionAttributeValues?.[":revision"]) { const error = new Error("conditional write rejected"); error.name = "ConditionalCheckFailedException"; throw error; }
      rows.set(key, structuredClone(input.Item!)); return { response: {}, output: { $metadata: {} } };
    }
    if (context.commandName === "QueryCommand") return { response: {}, output: { $metadata: {}, Items: [...rows.values()].filter(row => row.pk === input.ExpressionAttributeValues?.[":pk"]) } };
    throw new Error("Unexpected SDK command");
  }, { step: "initialize", name: "contractFake", priority: "high" });
  return { client, rows, commands, close: () => { base.destroy(); } };
};
describe("DynamoDB customer adapters (SDK command contracts)", () => {
  it("encrypts tokens, binds ciphertext to the key/revision/expiry and uses conditional writes and strong reads", async () => {
    const f = fixture(); const a = new DynamoAuthStore(f.client, "auth-test", "ab".repeat(32)); const b = new DynamoAuthStore(f.client, "auth-test", "ab".repeat(32));
    try {
      const record = { revision: "one", expiresAt: 9001, value: { accessToken: "synthetic-private-token" } };
      assert.equal(await a.write("session-hash", undefined, record), true);
      assert.doesNotMatch(JSON.stringify([...f.rows.values()]), /synthetic-private-token|accessToken/);
      assert.deepEqual(await b.read("session-hash"), record);
      assert.equal(await b.write("session-hash", undefined, { ...record, revision: "two" }), false);
      assert.equal(await b.write("session-hash", "one", { ...record, revision: "two" }), true);
      const storageKey = JSON.stringify(["auth-test", { id: "session-hash" }]); const row = f.rows.get(storageKey)!;
      assert.equal(row.ttl, 10);
      row.expiresAt = 1_000_000; row.ttl = 1000; await assert.rejects(a.read("session-hash"), /unavailable/);
      await a.remove("session-hash"); assert.equal(await b.read("session-hash"), undefined);
      for (const command of f.commands.filter(item => item.name === "GetItemCommand")) assert.equal((command.input as { ConsistentRead: boolean }).ConsistentRead, true);
    } finally { f.close(); }
  });
  it("requires matching app/subject and complete operator verification; links have no write API", async () => {
    const f = fixture(); const links = new DynamoCustomerLinkStore(f.client, "links-test");
    const id = customerLinkKey("client", "subject"); const key = JSON.stringify(["links-test", { id }]);
    const row = { id, version: 1, clientId: "client", amazonUserId: "subject", customerId: "customer-001", active: true, verifiedBy: "test-operator", verifiedAt: "2026-09-05T12:00:00Z", evidenceRef: "fictional-fixture-verification" };
    try {
      assert.equal(await links.findCustomer("client", "subject"), undefined);
      f.rows.set(key, row); assert.equal(await links.findCustomer("client", "subject"), "customer-001");
      assert.equal(await links.findCustomer("other-app", "subject"), undefined);
      f.rows.set(key, { ...row, active: false }); assert.equal(await links.findCustomer("client", "subject"), undefined);
      f.rows.set(key, { ...row, amazonUserId: "other-subject" }); await assert.rejects(links.findCustomer("client", "subject"), /unavailable/);
      const incomplete: Record<string, unknown> = { ...row }; delete incomplete.evidenceRef; f.rows.set(key, incomplete);
      await assert.rejects(links.findCustomer("client", "subject"), /unavailable/);
      assert.ok(f.commands.every(command => command.name === "GetItemCommand"));
    } finally { f.close(); }
  });
  it("queries only the principal's partition and rejects misfiled or mismatched repair projections", async () => {
    const f = fixture(); const repairs = new DynamoCustomerRepairs(f.client, "repairs-test");
    const owner = { subject: "lwa:test:one", customerId: "customer-001" }; const other = { subject: "lwa:test:two", customerId: "customer-002" };
    const row = { pk: "customer#customer-001", sk: "repair#1842", customerId: "customer-001", repair: { repairNumber: "1842", vehicle: "2019 Ford F-150", status: "diagnosis", scheduledStart: null, scheduledEnd: null }, estimate: null };
    const key = JSON.stringify(["repairs-test", { pk: row.pk, sk: row.sk }]);
    try {
      f.rows.set(key, row); assert.equal((await repairs.getRepair(owner, "1842")).repairNumber, "1842");
      assert.equal((await repairs.listRepairs(owner)).length, 1); assert.deepEqual(await repairs.listRepairs(other), []);
      await assert.rejects(repairs.getRepair(other, "1842"), /not available/);
      f.rows.set(key, { ...row, customerId: "customer-002" }); await assert.rejects(repairs.getRepair(owner, "1842"), /not available/);
      assert.ok(f.commands.every(command => command.name === "GetItemCommand" || command.name === "QueryCommand"));
    } finally { f.close(); }
  });
});
