import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { DynamoDBClient, CreateTableCommand, DeleteTableCommand, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, ScanCommand, UpdateCommand, type TransactWriteCommandInput } from "@aws-sdk/lib-dynamodb";
import { DynamoAuthStore, DynamoCustomerLinkStore, DynamoCustomerRepairs, customerLinkKey } from "./customer-dynamodb.js";
import { DurableCustomerWebsiteAuth } from "./durable-customer-auth.js";
import { CustomerEnrollment, CustomerEnrollmentRequests, CustomerEnrollmentRedemption, CustomerEnrollmentApproval, enrollmentHash, enrollmentIdentityKey } from "./customer-enrollment.js";
import { DynamoDesignatedEnrollmentApprover } from "./customer-enrollment-dynamodb-approve.js";
import { createPrivateApprovalLambda } from "./customer-enrollment-approval-lambda.js";
import { visibleEnrollmentAudit, ENROLLMENT_AUDIT_RETENTION_MS } from "./customer-enrollment-audit.js";
import { DynamoEnrollmentTransactions } from "./customer-enrollment-dynamodb.js";
import { rowSchema } from "./customer-enrollment-dynamodb-common.js";
import { DynamoEnrollmentRedeemer } from "./customer-enrollment-dynamodb-redeem.js";
import { createCustomerHttp } from "./customer-http.js";
import { EnrollmentSessionVerifier } from "./customer-enrollment-session.js";
import { createEnrollmentRequestLambda } from "./customer-enrollment-request-lambda.js";
import { createPrivateRedemptionLambda } from "./customer-enrollment-redeem-lambda.js";

// Opt-in emulator test. Explicit dummy credentials; refuses AWS and other hosts.
const endpoint = new URL(process.env.FLO_DYNAMODB_LOCAL_ENDPOINT ?? "http://127.0.0.1:8000");
if (endpoint.protocol !== "http:" || !["127.0.0.1", "localhost", "flo-dynamodb-test"].includes(endpoint.hostname) || endpoint.port !== "8000" || endpoint.username || endpoint.password || endpoint.pathname !== "/" || endpoint.search || endpoint.hash) throw new Error("Isolated DynamoDB Local endpoint required");
const base = new DynamoDBClient({ region: "us-west-2", endpoint: endpoint.href, credentials: { accessKeyId: "LOCALTESTONLY", secretAccessKey: "LOCALTESTONLY" }, maxAttempts: 1 });
const client = DynamoDBDocumentClient.from(base);
const prefix = `flo-enrollment-local-${randomBytes(8).toString("hex")}`;
const tables = { auth: `${prefix}-auth`, links: `${prefix}-links`, requests: `${prefix}-requests`, approvals: `${prefix}-approvals`, audit: `${prefix}-audit`, repairs: `${prefix}-repairs` };
const created: string[] = [];
try {
  await base.send(new ListTablesCommand({ Limit: 1 }));
  for (const [kind, TableName] of Object.entries(tables)) {
    const keys = kind === "repairs" ? ["pk", "sk"] : ["id"];
    await base.send(new CreateTableCommand({ TableName, BillingMode: "PAY_PER_REQUEST", KeySchema: keys.map((AttributeName, i) => ({ AttributeName, KeyType: i === 0 ? "HASH" : "RANGE" })), AttributeDefinitions: keys.map(AttributeName => ({ AttributeName, AttributeType: "S" })) }));
    created.push(TableName);
  }
  let now = Date.now(); let serial = 0;
  const key = randomBytes(32).toString("hex");
  const config = { clientId: "local-enrollment-client", clientSecret: "synthetic-only", publicOrigin: "https://flo.example" };
  const links = new DynamoCustomerLinkStore(client, tables.links);
  const makeAuth = () => new DurableCustomerWebsiteAuth(config, { exchange: async code => ({ subject: code, accessToken: code, expiresIn: 900 }), subject: async token => token }, links, new DynamoAuthStore(client, tables.auth, key), () => now);
  const auth = makeAuth();
  const transactions = new DynamoEnrollmentTransactions(client, tables, () => now);
  const service = new CustomerEnrollment(auth, transactions, async credential => {
    assert.equal(credential, "synthetic-operator");
    return { id: "synthetic-fixture-operator", allowedCustomerIds: ["staging-customer-a"] };
  }, () => now);
  const login = async (subject: string) => {
    const start = await auth.begin(`192.0.2.${++serial}`);
    return auth.finish(new URL(start.authorizationUrl).searchParams.get("state")!, start.browserNonce, subject);
  };
  const approve = (requestCode: string) => service.approve("synthetic-operator", { requestCode, customerId: "staging-customer-a", verification: { mode: "synthetic_test_designation", evidenceRef: "local-operator-test-designation" } });
  const prepare = async () => {
    const subject = `synthetic-owner-${serial + 1}`; const session = await login(subject);
    const request = await service.start(session, { consent: true }); const invitation = await approve(request.requestCode);
    return { subject, session, requestCode: request.requestCode, invitation: invitation.invitation, consent: true };
  };
  const body = (p: Awaited<ReturnType<typeof prepare>>) => ({ requestCode: p.requestCode, invitation: p.invitation, consent: true });
  const readRequest = async (code: string) => (await client.send(new GetCommand({ TableName: tables.requests, Key: { id: enrollmentHash(code) }, ConsistentRead: true }))).Item;

  // Exercise both deployable handler factories with the real encrypted emulator
  // store. Private invocation is in-process here; IAM is deliberately not claimed.
  const handlerIdentity = new EnrollmentSessionVerifier(config, new DynamoAuthStore(client, tables.auth, key), async token => token, () => now);
  const handlerRequests = new CustomerEnrollmentRequests(handlerIdentity, transactions, () => now);
  const privateHandler = createPrivateRedemptionLambda(new CustomerEnrollmentRedemption(handlerIdentity, transactions));
  const publicHandler = createEnrollmentRequestLambda({ publicOrigin: config.publicOrigin, apiId: "local-api", assets: new URL("../public/", import.meta.url), service: {
    start: handlerRequests.start.bind(handlerRequests), redeem: async (session, payload) => {
      const response = await privateHandler({ version: 1, operation: "redeem_fictional_customer", session, body: payload });
      if (!response.ok) throw new Error("Private fixture rejected");
      return response.result;
    }
  } });
  const handlerSession = await login("synthetic-handler-owner");
  const handlerEvent = (path: string, payload: unknown) => ({ version: "2.0", rawPath: path, rawQueryString: "", headers: { origin: config.publicOrigin, "content-type": "application/json" },
    cookies: [`__Host-flo-session=${handlerSession}`], body: JSON.stringify(payload), isBase64Encoded: false,
    requestContext: { apiId: "local-api", stage: "$default", http: { method: "POST", sourceIp: "192.0.2.8" } } });
  const startedHandler = await publicHandler(handlerEvent("/enrollment/request", { consent: true })); assert.equal(startedHandler.statusCode, 200);
  const handlerRequest = JSON.parse(startedHandler.body) as { requestCode: string };
  const designation = { purpose: "fictional_customer_pairing", customerId: "staging-customer-a", identityKey: enrollmentIdentityKey(await handlerIdentity.enrollmentIdentity(handlerSession)), authorityId: "fixture-private-authority", evidenceRef: "independent-fixture-only", expiresAt: now + 300_000 };
  const approvalHandler = (identityKey: string) => createPrivateApprovalLambda(new CustomerEnrollmentApproval(
    new DynamoDesignatedEnrollmentApprover(client, tables, identityKey, () => now),
    async () => ({ id: designation.authorityId, allowedCustomerIds: [designation.customerId] }), () => now), designation, () => now);
  const approvalEvent = { version: 1, operation: "approve_designated_fictional_customer", requestCode: handlerRequest.requestCode, confirmation: "approve_designated_pairing" };
  assert.deepEqual(await approvalHandler("f".repeat(64))(approvalEvent), { ok: false, status: 403 });
  assert.equal((await client.send(new GetCommand({ TableName: tables.approvals, Key: { id: enrollmentHash(handlerRequest.requestCode) }, ConsistentRead: true }))).Item, undefined);
  assert.deepEqual(await approvalHandler(designation.identityKey)({ ...approvalEvent, customerId: "staging-customer-b" }), { ok: false, status: 400 });
  const handlerApproval = await approvalHandler(designation.identityKey)(approvalEvent);
  assert.equal(handlerApproval.ok, true); if (!handlerApproval.ok) throw new Error("Fixture approval failed");
  const handlerRedeemBody = { requestCode: handlerRequest.requestCode, invitation: handlerApproval.result.invitation, consent: true };
  assert.equal((await publicHandler(handlerEvent("/enrollment/redeem", handlerRedeemBody))).statusCode, 200);
  assert.equal((await makeAuth().principal(handlerSession)).customerId, "staging-customer-a");
  assert.notEqual((await publicHandler(handlerEvent("/enrollment/redeem", handlerRedeemBody))).statusCode, 200);
  console.info("PASS: three separate handler factories over real emulator transactions; fixed identity and customer override rejection, valid approval and original-session redemption");

  // A request-table writer cannot invent operator authority, even with a valid
  // customer session and a self-selected invitation. Only the protected store counts.
  const forgedSession = await login("synthetic-forgery");
  const forgedRequest = await service.start(forgedSession, { consent: true });
  const forgedInvitation = "f".repeat(43);
  const forgedRow = await readRequest(forgedRequest.requestCode);
  await client.send(new PutCommand({ TableName: tables.requests, Item: { ...forgedRow, status: "approved", approval: {
    customerId: "staging-customer-b", operatorId: "forged-operator", approvedAt: new Date(now).toISOString(), invitationHash: enrollmentHash(forgedInvitation),
    verification: { mode: "synthetic_test_designation", evidenceRef: "forged" }
  } } }));
  await assert.rejects(service.redeem(forgedSession, { requestCode: forgedRequest.requestCode, invitation: forgedInvitation, consent: true }));
  assert.equal(await links.findCustomer(config.clientId, "synthetic-forgery"), undefined);
  console.info("PASS: forged approval in customer-writable request store cannot create a link");

  const bound = await prepare();
  const boundRow = rowSchema.parse(await readRequest(bound.requestCode));
  const approvalBefore = (await client.send(new GetCommand({ TableName: tables.approvals, Key: { id: enrollmentHash(bound.requestCode) }, ConsistentRead: true }))).Item;
  assert.equal(boundRow.approval, undefined);
  await assert.rejects(service.redeem(await login(bound.subject), body(bound)), "a new session for the same identity is not the original session");
  for (const mutation of [
    { identityKey: "0".repeat(64) },
    { proof: { ...boundRow.proof, revision: "substituted" } },
    { expiresAt: boundRow.expiresAt + 1 },
    { approval: { customerId: "staging-customer-b" } }
  ]) {
    await client.send(new PutCommand({ TableName: tables.requests, Item: { ...boundRow, ...mutation } }));
    await assert.rejects(service.redeem(bound.session, body(bound)));
    assert.equal(await links.findCustomer(config.clientId, bound.subject), undefined);
  }
  await client.send(new PutCommand({ TableName: tables.requests, Item: boundRow }));
  assert.equal((await service.redeem(bound.session, body(bound))).linked, true);
  assert.deepEqual((await client.send(new GetCommand({ TableName: tables.approvals, Key: { id: enrollmentHash(bound.requestCode) }, ConsistentRead: true }))).Item, approvalBefore);
  assert.equal((await readRequest(bound.requestCode))?.status, "consumed");
  console.info("PASS: approved snapshot binds identity/session/expiry; request tampering denied; redemption leaves approval immutable");

  const changedApproval = await prepare();
  // Test-only interleaving: a privileged store writer changes the protected
  // snapshot after the redeemer reads it but before its transaction commits.
  class RacingRedeemer extends DynamoEnrollmentRedeemer {
    protected override async transact(actions: NonNullable<TransactWriteCommandInput["TransactItems"]>) {
      await client.send(new UpdateCommand({ TableName: tables.approvals, Key: { id: enrollmentHash(changedApproval.requestCode) },
        UpdateExpression: "SET approval.customerId = :other", ExpressionAttributeValues: { ":other": "staging-customer-b" } }));
      return super.transact(actions);
    }
  }
  assert.equal(await new RacingRedeemer(client, tables, () => now).redeem(enrollmentHash(changedApproval.requestCode), enrollmentHash(changedApproval.invitation), await auth.enrollmentIdentity(changedApproval.session)), false);
  assert.equal(await links.findCustomer(config.clientId, changedApproval.subject), undefined);
  assert.equal((await readRequest(changedApproval.requestCode))?.status, "pending");
  console.info("PASS: approval mutation between read and commit rejects atomically without creating a link or consuming request");

  const p = await prepare();
  await assert.rejects(service.redeem(await login("synthetic-attacker"), body(p)));
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => service.redeem(p.session, body(p))));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  await assert.rejects(service.redeem(p.session, body(p)));
  assert.equal((await makeAuth().principal(p.session)).customerId, "staging-customer-a");
  for (const [customerId, repairNumber, vehicle] of [["staging-customer-a", "1842", "Fictional Ford A"], ["staging-customer-b", "2842", "Fictional vehicle B"]] as const) {
    await client.send(new PutCommand({ TableName: tables.repairs, Item: { pk: `customer#${customerId}`, sk: `repair#${repairNumber}`, customerId, repair: { repairNumber, vehicle, status: "diagnosis", scheduledStart: null, scheduledEnd: null }, estimate: null } }));
  }
  const http = createCustomerHttp({ auth: makeAuth(), experience: new DynamoCustomerRepairs(client, tables.repairs) });
  const command = (repairNumber: string) => http(new Request(config.publicOrigin + "/api/customer/command", { method: "POST", headers: { origin: config.publicOrigin, "content-type": "application/json", cookie: `__Host-flo-session=${p.session}` }, body: JSON.stringify({ command: `Show repair ${repairNumber}` }) }), "192.0.2.2");
  const own = await command("1842"); assert.equal(own.status, 200); assert.match(await own.text(), /Fictional Ford A/);
  assert.equal(await (await command("2842")).text(), await (await command("9999")).text());
  console.info("PASS: eight-way atomic redemption, replay rejection, new-instance persistence, MCP A access and B isolation");

  const q = await prepare();
  const collisionId = `${enrollmentHash(q.requestCode)}#link_created`;
  await client.send(new PutCommand({ TableName: tables.audit, Item: { id: collisionId, syntheticCollision: true } }));
  await assert.rejects(service.redeem(q.session, body(q)));
  assert.equal(await links.findCustomer(config.clientId, q.subject), undefined);
  assert.equal((await readRequest(q.requestCode))?.status, "pending");
  await client.send(new DeleteCommand({ TableName: tables.audit, Key: { id: collisionId } }));
  assert.equal((await service.redeem(q.session, body(q))).linked, true);
  console.info("PASS: audit collision rolls back both invitation consumption and link creation");

  const r = await prepare(); const proof = await auth.enrollmentIdentity(r.session);
  await auth.logout(r.session);
  assert.equal(await transactions.redeem(enrollmentHash(r.requestCode), enrollmentHash(r.invitation), proof), false);
  assert.equal(await links.findCustomer(config.clientId, r.subject), undefined);
  const expired = await prepare(); now += 300_001;
  await assert.rejects(service.redeem(expired.session, body(expired)));
  assert.equal((await readRequest(expired.requestCode))?.status, "pending", "TTL deliberately not relied upon");
  console.info("PASS: session deletion checked at commit; expired invitation rejected while TTL row remains");

  await client.send(new UpdateCommand({ TableName: tables.links, Key: { id: customerLinkKey(config.clientId, p.subject) }, UpdateExpression: "SET active = :off", ExpressionAttributeValues: { ":off": false } }));
  await assert.rejects(auth.principal(p.session), /not linked/);
  await assert.rejects(service.start(p.session, { consent: true }));
  await auth.logout(q.session); await assert.rejects(makeAuth().principal(q.session), /sign in/);
  const same = await login("synthetic-same-owner");
  const startRace = await Promise.allSettled([service.start(same, { consent: true }), service.start(same, { consent: true })]);
  assert.equal(startRace.filter(result => result.status === "fulfilled").length, 1);
  const started = startRace.find((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof service.start>>> => result.status === "fulfilled")!.value;
  const approveRace = await Promise.allSettled([approve(started.requestCode), approve(started.requestCode)]);
  assert.equal(approveRace.filter(result => result.status === "fulfilled").length, 1);
  const fullWindow = Math.floor(now / 300_000);
  await client.send(new PutCommand({ TableName: tables.requests, Item: { id: `admission#${fullWindow}`, count: 500, ttl: (fullWindow + 2) * 300 } }));
  await assert.rejects(service.start(await login("synthetic-at-limit"), { consent: true }));
  const audit = await client.send(new ScanCommand({ TableName: tables.audit, ConsistentRead: true }));
  assert.equal(audit.LastEvaluatedKey, undefined);
  const retainedAudit = visibleEnrollmentAudit(audit.Items ?? [], now);
  assert.equal(retainedAudit.length, audit.Items?.length);
  assert.ok(retainedAudit.length > 0);
  assert.ok(retainedAudit.some(row => row.action === "operator_approved"));
  assert.ok(retainedAudit.some(row => row.action === "link_created"));
  assert.deepEqual(visibleEnrollmentAudit(audit.Items ?? [], now + ENROLLMENT_AUDIT_RETENTION_MS), []);
  console.info("PASS: persisted audit records have 30-day expiry/TTL; expired snapshot rows are excluded without waiting for physical deletion");
  for (const secret of [p.session, p.requestCode, p.invitation, q.invitation]) assert.ok(!JSON.stringify(audit.Items).includes(secret));
  console.info("PASS: revocation and logout, concurrent request/approval isolation, admission ceiling, no bearer codes in audit");
  console.info("ENROLLMENT_DYNAMODB_LOCAL_PASS: real emulator transactions and existing HTTP/MCP; synthetic identities, not AWS IAM or hosted enrollment.");
} finally {
  for (const TableName of created) await base.send(new DeleteTableCommand({ TableName }));
  base.destroy();
}
