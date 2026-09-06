import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CustomerAuthError, type CustomerPrincipal } from "@flo/agent";
import { FloError } from "@flo/shared-types";
import { createCustomerLambda } from "./customer-lambda.js";
import { DurableCustomerWebsiteAuth, type AtomicAuthStore, type StoredAuthRecord } from "./durable-customer-auth.js";

const config = { clientId: "lambda-contract", clientSecret: "amzn1.oa2-cs.v1." + "a".repeat(64), publicOrigin: "https://api-test.execute-api.us-west-2.amazonaws.com" };
const event = (path: string, method = "GET", body?: unknown, cookies: string[] = [], headers: Record<string, string> = {}) => {
  const url = new URL(path, config.publicOrigin);
  return { version: "2.0", rawPath: url.pathname, rawQueryString: url.search.slice(1), headers: { origin: config.publicOrigin, "content-type": "application/json", ...headers }, cookies,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), isBase64Encoded: false,
    requestContext: { apiId: "api-test", stage: "$default", http: { method, sourceIp: "192.0.2.5" } } };
};
const fixture = () => {
  let now = 1000; const rows = new Map<string, StoredAuthRecord>();
  const store: AtomicAuthStore = { read: async key => structuredClone(rows.get(key)), write: async (key, revision, row) => { if (rows.get(key)?.revision !== revision) return false; rows.set(key, structuredClone(row)); return true; }, remove: async key => { rows.delete(key); } };
  const links = new Map([["one", "customer-001"], ["two", "customer-002"]]); const revoked = new Set<string>();
  let beforeRead: (() => Promise<void>) | undefined;
  const repair = { repairNumber: "1842", vehicle: "2019 Ford F-150", status: "diagnosis", scheduledStart: null, scheduledEnd: null };
  const experience = {
    listRepairs: async (principal: CustomerPrincipal) => { await beforeRead?.(); return principal.customerId === "customer-001" ? [repair] : []; },
    getRepair: async (principal: CustomerPrincipal, number: string) => {
      await beforeRead?.();
      if (principal.customerId !== "customer-001" || number !== "1842") throw new FloError({ code: "REPAIR_UNAVAILABLE", message: "That repair is not available for your account.", retryable: false });
      return repair;
    },
    getEstimate: async () => { throw new FloError({ code: "ESTIMATE_NOT_READY", message: "Estimate is not ready.", retryable: true }); }
  };
  const makeAuth = () => new DurableCustomerWebsiteAuth(config, { exchange: async code => ({ accessToken: code, subject: code, expiresIn: 60 }), subject: async token => { if (revoked.has(token)) throw new CustomerAuthError(401, "SIGN_IN_REQUIRED"); return token; } }, { findCustomer: async (_client, subject) => links.get(subject) }, store, () => now);
  const a = makeAuth(); const b = makeAuth();
  const create = (auth = a) => createCustomerLambda({ auth, experience, publicOrigin: config.publicOrigin, apiId: "api-test", assets: new URL("../public/", import.meta.url) });
  const first = create(); const second = create(b);
  const login = async (subject = "one") => {
    const start = await first(event("/auth/lwa/start", "POST", { consent: true })); assert.equal(start.statusCode, 200);
    const data = JSON.parse(start.body) as { authorizationUrl: string }; const state = new URL(data.authorizationUrl).searchParams.get("state")!;
    const callback = await second(event(`/auth/lwa/callback?${new URLSearchParams({ state, code: subject })}`, "GET", undefined, start.cookies.map(item => item.split(";")[0]!)));
    assert.equal(callback.statusCode, 303); assert.equal(callback.headers.location, "/"); assert.equal(callback.cookies.length, 2);
    return callback.cookies.find(item => item.startsWith("__Host-flo-session="))!.split(";")[0]!;
  };
  return { first, second, create, login, a, b, links, revoked, expire: () => { now += 61_000; }, beforeRead: (fn: () => Promise<void>) => { beforeRead = fn; } };
};
describe("customer Lambda payload-v2 and durable website boundary (simulated Amazon)", () => {
  it("uses a restart-safe session through an actual MCP tool exchange", async () => {
    const f = fixture(); const cookie = await f.login();
    const result = await f.create()(event("/api/customer/command", "POST", { command: "Status of repair 1842" }, [cookie]));
    assert.equal(result.statusCode, 200); assert.match(result.body, /get_my_repair/); assert.match(result.body, /2019 Ford F-150/);
    assert.equal(result.headers["cache-control"], "no-store"); assert.ok(result.headers["content-security-policy"]);
    assert.doesNotMatch(result.body, /accessToken|customerId|diagnosis":|margin|vin":/);
  });
  it("isolates customers and never accepts service credentials or body/header overrides", async () => {
    const f = fixture(); const cookie = await f.login("two");
    const result = await f.first(event("/api/customer/command", "POST", { command: "Status of repair 1842" }, [cookie], { "x-flo-customer-id": "customer-001", "x-flo-role": "administrator" }));
    assert.equal(result.statusCode, 200); assert.doesNotMatch(result.body, /Ford|F-150/); assert.match(result.body, /"ok":false/);
    assert.equal((await f.first(event("/api/customer/command", "POST", { command: "Show my repairs", customerId: "customer-001" }, [cookie]))).statusCode, 400);
    for (const credential of ["AWS4-HMAC-SHA256", "service-token", "one", "x".repeat(43)]) {
      assert.equal((await f.first(event("/auth/session", "GET", undefined, [`__Host-flo-session=${credential}`]))).statusCode, 401);
      assert.equal((await f.first(event("/website/mcp", "POST", {}, [], { authorization: `Bearer ${credential}` }))).statusCode, 401);
    }
    assert.equal((await f.first(event("/alexa/mcp", "GET", undefined, [cookie]))).statusCode, 401);
  });
  it("rejects unlinked, expired and revoked identities and logout on another instance", async () => {
    const f = fixture();
    const unlinked = await f.login("unlinked"); assert.equal((await f.first(event("/auth/session", "GET", undefined, [unlinked]))).statusCode, 403);
    const expired = await f.login(); f.expire(); assert.equal((await f.second(event("/auth/session", "GET", undefined, [expired]))).statusCode, 401);
    const out = await f.login(); assert.equal((await f.second(event("/auth/logout", "POST", {}, [out]))).statusCode, 200);
    assert.equal((await f.first(event("/auth/session", "GET", undefined, [out]))).statusCode, 401);
    const revoked = await f.login(); f.revoked.add("one"); assert.equal((await f.first(event("/auth/session", "GET", undefined, [revoked]))).statusCode, 401);
  });
  it("suppresses results after mid-tool reassignment or cross-instance logout", async () => {
    for (const action of ["reassign", "logout"] as const) {
      const f = fixture(); const cookie = await f.login(); let release: () => void = () => undefined; let ready: () => void = () => undefined;
      const started = new Promise<void>(resolve => { ready = resolve; });
      f.beforeRead(() => new Promise<void>(resolve => { release = resolve; ready(); }));
      const pending = f.first(event("/api/customer/command", "POST", { command: "Show my repairs" }, [cookie])); await started;
      if (action === "reassign") f.links.set("one", "customer-002"); else await f.b.logout(cookie.split("=")[1]!);
      release(); const result = await pending;
      assert.equal(result.statusCode, 401); assert.doesNotMatch(result.body, /Ford|1842|"data":/);
    }
  });
  it("trusts API Gateway source context, not forged proxy headers; validates origin, payload and duplicate cookies", async () => {
    const f = fixture();
    for (let i = 0; i < 5; i++) assert.equal((await f.first(event("/auth/lwa/start", "POST", { consent: true }, [], { "x-flo-client-ip": `192.0.2.${i}`, "x-forwarded-for": `192.0.2.${i}`, host: "attacker.test" }))).statusCode, 200);
    assert.equal((await f.second(event("/auth/lwa/start", "POST", { consent: true }, [], { "x-flo-client-ip": "192.0.2.99" }))).statusCode, 429);
    assert.equal((await f.first(event("/auth/logout", "POST", {}, [], { origin: "https://attacker.test" }))).statusCode, 403);
    assert.equal((await f.first({ ...event("/"), version: "1.0" })).statusCode, 503);
    assert.equal((await f.first({ ...event("/"), rawPath: "//attacker.test" })).statusCode, 503);
    assert.equal((await f.first({ ...event("/auth/logout", "POST"), body: "x".repeat(9000) })).statusCode, 413);
    const g = fixture(); const cookie = await g.login();
    assert.equal((await g.first(event("/auth/session", "GET", undefined, [cookie, cookie]))).statusCode, 401);
    const payload = event("/api/customer/command", "POST", { command: "Show my repairs" }, [cookie]);
    const encoded = await g.first({ ...payload, isBase64Encoded: true, body: Buffer.from(payload.body!).toString("base64") });
    assert.equal(encoded.statusCode, 200); assert.match(encoded.body, /list_my_repairs/);
  });
  it("includes landing, privacy and terms assets and fails closed without LWA", async () => {
    const handler = createCustomerLambda({ publicOrigin: config.publicOrigin, apiId: "api-test", experience: { listRepairs: async () => [], getRepair: async () => { throw new Error(); }, getEstimate: async () => { throw new Error(); } }, assets: new URL("../public/", import.meta.url) });
    for (const path of ["/", "/privacy", "/terms", "/signin.js", "/signin.css"]) assert.equal((await handler(event(path))).statusCode, 200);
    const configured = fixture().first;
    for (const path of ["/pairing", "/pairing.js", "/enrollment/request", "/enrollment/redeem", "/enrollment/approve"]) {
      assert.equal((await configured(event(path))).statusCode, 404);
      assert.equal((await handler(event(path))).statusCode, 503); // Disabled LWA fails closed before route dispatch.
    }
    const privacy = await handler(event("/privacy")); assert.match(privacy.body, /Alexander Ammann/); assert.match(privacy.body, /xyes47314@gmail.com/);
    assert.equal((await handler(event("/auth/session"))).statusCode, 503);
  });
});
