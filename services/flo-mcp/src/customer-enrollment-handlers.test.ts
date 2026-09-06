import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { CustomerAuthError } from "@flo/agent";
import { z } from "zod";
import { DurableCustomerWebsiteAuth } from "./durable-customer-auth.js";
import { LocalEnrollmentStore } from "./customer-enrollment-local.js";
import { CustomerEnrollmentRequests, CustomerEnrollmentRedemption, CustomerEnrollmentApproval } from "./customer-enrollment.js";
import { EnrollmentSessionVerifier, createEnrollmentSubjectLookup } from "./customer-enrollment-session.js";
import { createEnrollmentRequestLambda, handler as publicHandler } from "./customer-enrollment-request-lambda.js";
import { createPrivateRedemptionLambda, handler as privateHandler } from "./customer-enrollment-redeem-lambda.js";
import { LambdaEnrollmentRedemption } from "./customer-enrollment-invoke.js";

const origin = "https://flo.example";
const config = { clientId: "handler-test", clientSecret: "synthetic-only", publicOrigin: origin };
const target = "arn:aws:lambda:us-west-2:123456789012:function:synthetic-redeemer:1";
const event = (path: string, session = "", body: unknown = { consent: true }) => ({ version: "2.0", rawPath: path, rawQueryString: "",
  headers: { origin, "content-type": "application/json" }, cookies: session ? [`__Host-flo-session=${session}`] : [], body: JSON.stringify(body), isBase64Encoded: false,
  requestContext: { apiId: "test-api", stage: "$default", http: { method: "POST", sourceIp: "192.0.2.4" } } });

function fixture() {
  let now = Date.now(); let serial = 0; let unavailable = false; let revoked = false;
  const store = new LocalEnrollmentStore("local-test-only", () => now);
  const subject = async (token: string) => { if (unavailable) throw new Error("sensitive-provider-error"); if (revoked) throw new CustomerAuthError(401, "SIGN_IN_REQUIRED"); return token; };
  const auth = new DurableCustomerWebsiteAuth(config, { exchange: async code => ({ subject: code, accessToken: code, expiresIn: 900 }), subject }, store, store, () => now);
  const verifier = new EnrollmentSessionVerifier(config, { read: store.read.bind(store) }, subject, () => now);
  const requests = new CustomerEnrollmentRequests(verifier, store, () => now);
  const privateLambda = createPrivateRedemptionLambda(new CustomerEnrollmentRedemption(verifier, store));
  const calls: unknown[] = [];
  let override: Record<string, unknown> | undefined;
  const client = new LambdaClient({ region: "us-west-2", credentials: { accessKeyId: "LOCALTESTONLY", secretAccessKey: "LOCALTESTONLY" }, maxAttempts: 1 });
  client.middlewareStack.add((_next, context) => async args => {
    assert.equal(context.commandName, "InvokeCommand"); calls.push(structuredClone(args.input));
    const input = z.object({ FunctionName: z.literal(target), InvocationType: z.literal("RequestResponse"), LogType: z.literal("None"), Payload: z.instanceof(Uint8Array) }).parse(args.input);
    const output = override ?? { StatusCode: 200, Payload: Buffer.from(JSON.stringify(await privateLambda(JSON.parse(Buffer.from(input.Payload).toString("utf8")) as unknown))) };
    return { response: {}, output: { $metadata: {}, ...output } };
  }, { step: "initialize", name: "privateInvokeContract", priority: "high" });
  const invoke = new LambdaEnrollmentRedemption(client, target, "123456789012", "us-west-2");
  const publicLambda = createEnrollmentRequestLambda({ service: { start: requests.start.bind(requests), redeem: async (session, body) => { await verifier.enrollmentIdentity(session); return invoke.redeem(session, body); } }, publicOrigin: origin, apiId: "test-api", assets: new URL("../public/", import.meta.url) });
  const operator = new CustomerEnrollmentApproval(store, async () => ({ id: "synthetic-operator", allowedCustomerIds: ["customer-a"] }), () => now);
  const login = async (name: string) => { const pending = await auth.begin(`192.0.2.${++serial}`); return auth.finish(new URL(pending.authorizationUrl).searchParams.get("state")!, pending.browserNonce, name); };
  return { store, auth, verifier, login, operator, calls, client, invoke, publicLambda, privateLambda, expire: () => { now += 901_000; }, revoke: () => { revoked = true; }, failProvider: () => { unavailable = true; }, respond: (v: Record<string, unknown>) => { override = v; } };
}

describe("separate enrollment Lambda handlers (local sessions and simulated AWS invocation)", () => {
  it("starts and redeems through the two handlers while preserving independently designated customer scope", async () => {
    const f = fixture();
    try {
      const session = await f.login("owner-a");
      const started = await f.publicLambda(event("/enrollment/request", session)); assert.equal(started.statusCode, 200);
      const request = z.object({ requestCode: z.string(), status: z.literal("awaiting_operator_verification") }).parse(JSON.parse(started.body));
      assert.doesNotMatch(started.body, /owner-a|customer-a|accessToken|sessionKey/);
      const approval = await f.operator.approve("", { requestCode: request.requestCode, customerId: "customer-a", verification: { mode: "synthetic_test_designation", evidenceRef: "independent-fixture" } });
      const body = { requestCode: request.requestCode, invitation: approval.invitation, consent: true };
      assert.equal((await f.publicLambda(event("/enrollment/redeem", await f.login("owner-b"), body))).statusCode, 403);
      const linked = await f.publicLambda(event("/enrollment/redeem", session, body)); assert.equal(linked.statusCode, 200);
      assert.deepEqual(JSON.parse(linked.body), { linked: true, scope: "fictional_staging_customer" });
      assert.equal(await f.store.findCustomer(config.clientId, "owner-a"), "customer-a");
      assert.equal(await f.store.findCustomer(config.clientId, "owner-b"), undefined);
      assert.equal((await f.publicLambda(event("/enrollment/redeem", session, body))).statusCode, 403);
      assert.equal(linked.headers["cache-control"], "no-store");
    } finally { f.client.destroy(); }
  });
  it("denies missing/service credentials, expired/logout/revoked sessions, and rechecks after provider lookup", async () => {
    const f = fixture();
    try {
      for (const s of ["", "AWS4-HMAC-SHA256", "service-token", "x".repeat(43)]) assert.equal((await f.publicLambda(event("/enrollment/request", s))).statusCode, 401);
      assert.deepEqual(await f.privateLambda({ version: 1, operation: "redeem_fictional_customer", session: "x".repeat(43), body: { requestCode: "r".repeat(43), invitation: "i".repeat(43), consent: true } }), { ok: false, status: 401 });
      const loggedOut = await f.login("out"); await f.auth.logout(loggedOut); await assert.rejects(f.verifier.enrollmentIdentity(loggedOut));
      const expired = await f.login("expired"); f.expire(); await assert.rejects(f.verifier.enrollmentIdentity(expired));
      const active = await f.login("revoked"); f.revoke(); await assert.rejects(f.verifier.enrollmentIdentity(active));
      assert.equal(f.calls.length, 0);
      const g = fixture();
      try {
        const session = await g.login("race");
        const verifier = new EnrollmentSessionVerifier(config, g.store, async token => { await g.auth.logout(session); return token; });
        await assert.rejects(verifier.enrollmentIdentity(session));
      } finally { g.client.destroy(); }
    } finally { f.client.destroy(); }
  });
  it("rejects transport spoofing, duplicate cookies, missing consent and customer/proof overrides before transactions", async () => {
    const f = fixture();
    try {
      const session = await f.login("owner"); const valid = event("/enrollment/request", session);
      for (const body of [{ consent: false }, { consent: true, customerId: "customer-b" }, { consent: true, proof: {} }]) assert.equal((await f.publicLambda(event("/enrollment/request", session, body))).statusCode, 400);
      assert.equal((await f.publicLambda({ ...valid, headers: { ...valid.headers, origin: "https://evil.example" } })).statusCode, 403);
      assert.equal((await f.publicLambda({ ...valid, cookies: [valid.cookies[0], valid.cookies[0]] })).statusCode, 401);
      assert.equal((await f.publicLambda({ ...valid, cookies: [], headers: { ...valid.headers, cookie: valid.cookies[0], authorization: "service-token", "x-flo-customer-id": "customer-a" } })).statusCode, 401);
      assert.equal((await f.publicLambda({ ...valid, requestContext: { ...valid.requestContext, apiId: "wrong" } })).statusCode, 403);
      assert.equal((await f.publicLambda({ ...valid, version: "1.0" })).statusCode, 400);
      assert.equal((await f.publicLambda({ ...valid, body: "x".repeat(2049) })).statusCode, 413);
      assert.equal((await f.publicLambda({ ...valid, body: "%%%", isBase64Encoded: true })).statusCode, 400);
      assert.equal((await f.publicLambda({ ...valid, rawQueryString: "session=secret" })).statusCode, 400);
      for (const path of ["/enrollment/approve", "/api/customer/command", "//evil.example", "/auth/lwa/start"]) assert.equal((await f.publicLambda({ ...valid, rawPath: path })).statusCode, 404);
      assert.deepEqual(await f.privateLambda({ ...valid, version: "2.0" }), { ok: false, status: 400 });
      assert.deepEqual(await f.privateLambda({ version: 1, operation: "redeem_fictional_customer", session, body: { requestCode: "r".repeat(43), invitation: "i".repeat(43), consent: true }, proof: {} }), { ok: false, status: 400 });
      assert.equal(f.calls.length, 0);
    } finally { f.client.destroy(); }
  });
  it("treats Lambda function errors, async status, malformed or oversized responses as failure, never success", async () => {
    const f = fixture();
    try {
      for (const output of [{ StatusCode: 202 }, { StatusCode: 200, FunctionError: "Unhandled", Payload: Buffer.from("private-sensitive-error") },
        { StatusCode: 200, Payload: Buffer.from("not-json") }, { StatusCode: 200, Payload: Buffer.alloc(4097) },
        { StatusCode: 200, Payload: Buffer.from(JSON.stringify({ ok: true, result: { linked: true, scope: "fictional_staging_customer", customerId: "forged" } })) }]) {
        f.respond(output);
        await assert.rejects(f.invoke.redeem("s".repeat(43), { requestCode: "r".repeat(43), invitation: "i".repeat(43), consent: true }), error => error instanceof CustomerAuthError && error.status === 503 && !error.message.includes("private-sensitive"));
      }
      assert.equal(f.calls.length, 5, "one invocation per attempt, no retry");
      for (const arn of [target.replace(":1", ":$LATEST"), target.replace("us-west-2", "us-east-2"), target.replace("123456789012", "999999999999"), "https://evil.example", target.slice(0, -2)]) assert.throws(() => new LambdaEnrollmentRedemption(f.client, arn, "123456789012", "us-west-2"));
    } finally { f.client.destroy(); }
  });
  it("redacts dependency errors, supports binary API payloads and serves only pairing assets", async () => {
    const f = fixture();
    try {
      const session = await f.login("owner"); const valid = event("/enrollment/request", session);
      assert.equal((await f.publicLambda({ ...valid, body: Buffer.from(valid.body).toString("base64"), isBase64Encoded: true })).statusCode, 200);
      f.failProvider(); const failure = await f.publicLambda(event("/enrollment/request", session));
      assert.equal(failure.statusCode, 503); assert.doesNotMatch(failure.body, /sensitive-provider-error/);
      for (const path of ["/pairing", "/pairing.js"]) {
        const result = await f.publicLambda({ ...valid, rawPath: path, body: undefined, requestContext: { ...valid.requestContext, http: { ...valid.requestContext.http, method: "GET" } } });
        assert.equal(result.statusCode, 200); assert.ok(result.headers["content-security-policy"]);
      }
      assert.deepEqual(await privateHandler({}), { ok: false, status: 503 });
      assert.equal((await publicHandler({})).statusCode, 503);
    } finally { f.client.destroy(); }
  });
  it("profile lookup uses only a fixed HTTPS endpoint, bounded bodies and no client secret", async () => {
    const lookup = createEnrollmentSubjectLookup(async (url, options) => {
      assert.equal(url, "https://api.amazon.com/user/profile"); assert.equal(options?.redirect, "error");
      assert.equal(new Headers(options?.headers).get("authorization"), "Bearer synthetic-token");
      assert.equal(options?.body, undefined); assert.ok(options?.signal);
      return Response.json({ user_id: "synthetic-subject" });
    });
    assert.equal(await lookup("synthetic-token"), "synthetic-subject");
    for (const response of [new Response("denied", { status: 401 }), Response.json({}), new Response("x".repeat(32769)), new Response("bad", { status: 503 })]) await assert.rejects(createEnrollmentSubjectLookup(async () => response)("synthetic-token"));
  });
});
