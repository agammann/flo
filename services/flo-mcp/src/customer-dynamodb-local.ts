import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { DynamoDBClient, CreateTableCommand, DeleteTableCommand, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoAuthStore, DynamoCustomerLinkStore, DynamoCustomerRepairs, customerLinkKey } from "./customer-dynamodb.js";
import { DurableCustomerWebsiteAuth } from "./durable-customer-auth.js";

// Deliberately separate from normal unit tests. Refuse any AWS/remote endpoint.
const endpoint = new URL(process.env.FLO_DYNAMODB_LOCAL_ENDPOINT ?? "http://127.0.0.1:8000");
if (endpoint.protocol !== "http:" || !["127.0.0.1", "localhost", "flo-dynamodb-test"].includes(endpoint.hostname) || endpoint.port !== "8000" || endpoint.username || endpoint.password || endpoint.pathname !== "/") throw new Error("This test may run only against the isolated DynamoDB Local endpoint.");
const base = new DynamoDBClient({ region: "us-west-2", endpoint: endpoint.href, credentials: { accessKeyId: "LOCALTESTONLY", secretAccessKey: "LOCALTESTONLY" }, maxAttempts: 1 });
const client = DynamoDBDocumentClient.from(base);
const prefix = `flo-local-${randomBytes(8).toString("hex")}`;
const tables = { auth: `${prefix}-auth`, links: `${prefix}-links`, repairs: `${prefix}-repairs` };
const created: string[] = [];
try {
  for (let attempt = 0; ; attempt++) {
    try { await base.send(new ListTablesCommand({ Limit: 1 })); break; }
    catch (error) { if (attempt >= 29) throw error; await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  for (const [kind, TableName] of Object.entries(tables)) {
    const keys = kind === "repairs" ? ["pk", "sk"] : ["id"];
    await base.send(new CreateTableCommand({ TableName, BillingMode: "PAY_PER_REQUEST", KeySchema: keys.map((AttributeName, i) => ({ AttributeName, KeyType: i === 0 ? "HASH" : "RANGE" })), AttributeDefinitions: keys.map(AttributeName => ({ AttributeName, AttributeType: "S" })) }));
    created.push(TableName);
  }
  const key = randomBytes(32).toString("hex"); const storeA = new DynamoAuthStore(client, tables.auth, key); const storeB = new DynamoAuthStore(client, tables.auth, key);
  const config = { clientId: "local-contract-client", clientSecret: "synthetic-only", publicOrigin: "https://flo.example" };
  const links = new DynamoCustomerLinkStore(client, tables.links);
  let exchanges = 0; let now = Date.now();
  const provider = { exchange: async () => { exchanges++; return { accessToken: "local-token", subject: "local-owner", expiresIn: 60 }; }, subject: async () => "local-owner" };
  const first = new DurableCustomerWebsiteAuth(config, provider, links, storeA, () => now);
  const second = new DurableCustomerWebsiteAuth(config, provider, links, storeB, () => now);
  const start = await first.begin("192.0.2.10"); const state = new URL(start.authorizationUrl).searchParams.get("state")!;
  const race = await Promise.allSettled([first.finish(state, start.browserNonce, "test-code"), second.finish(state, start.browserNonce, "test-code")]);
  assert.equal(race.filter(item => item.status === "fulfilled").length, 1); assert.equal(exchanges, 1);
  const session = race.find((item): item is PromiseFulfilledResult<string> => item.status === "fulfilled")!.value;
  await assert.rejects(second.principal(session), /not linked/);
  const id = customerLinkKey(config.clientId, "local-owner");
  await client.send(new PutCommand({ TableName: tables.links, Item: { id, version: 1, clientId: config.clientId, amazonUserId: "local-owner", customerId: "customer-001", active: true, verifiedBy: "automated-local-fixture", verifiedAt: new Date().toISOString(), evidenceRef: "fictional-test-only" } }));
  assert.equal((await second.principal(session)).customerId, "customer-001");
  const repairs = new DynamoCustomerRepairs(client, tables.repairs);
  await client.send(new PutCommand({ TableName: tables.repairs, Item: { pk: "customer#customer-001", sk: "repair#1842", customerId: "customer-001", repair: { repairNumber: "1842", vehicle: "2019 Ford F-150", status: "diagnosis", scheduledStart: null, scheduledEnd: null }, estimate: null } }));
  assert.equal((await repairs.listRepairs(await second.principal(session))).length, 1);
  await assert.rejects(repairs.getRepair({ subject: "other", customerId: "customer-002" }, "1842"), /not available/);
  now += 61_000; await assert.rejects(first.principal(session), /sign in/);
  await second.logout(session); assert.equal([...created].length, 3);
  console.info("DynamoDB Local integration passed: encrypted persistence, atomic callback race, cross-instance session, trusted link, customer isolation, explicit expiry and logout.");
} finally {
  // Only tables created by this invocation in the explicitly local emulator.
  for (const TableName of created) await base.send(new DeleteTableCommand({ TableName }));
  base.destroy();
}
