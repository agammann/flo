import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CustomerAuthError, type LwaProvider } from "@flo/agent";
import { FloError } from "@flo/shared-types";
import { DurableCustomerWebsiteAuth } from "./durable-customer-auth.js";
import { CustomerEnrollment, EnrollmentError, type EnrollmentTransactions } from "./customer-enrollment.js";
import { LocalEnrollmentStore } from "./customer-enrollment-local.js";
import { createEnrollmentHttp } from "./customer-enrollment-http.js";
import { createCustomerHttp } from "./customer-http.js";

const config = { clientId: "pairing-local-test", clientSecret: "synthetic-only", publicOrigin: "https://flo.example" };
const verification = { mode: "synthetic_test_designation", evidenceRef: "local-fixture-operator-designation" };
function fixture() {
  let now = 1_800_000_000_000;
  const store = new LocalEnrollmentStore("local-test-only", () => now);
  const provider: LwaProvider = { exchange: async code => ({ accessToken: code, subject: code, expiresIn: 900 }), subject: async token => token };
  const auth = new DurableCustomerWebsiteAuth(config, provider, store, store, () => now);
  const transactions: EnrollmentTransactions = { start: row => store.start(row), approve: (id, approval) => store.approve(id, approval), redeem: (id, invitation, proof) => store.redeem(id, invitation, proof) };
  const enrollment = new CustomerEnrollment(auth, transactions, async credential => {
    if (credential !== "local-operator-capability") throw new EnrollmentError();
    return { id: "fixture-operator", allowedCustomerIds: ["staging-customer-a"] };
  }, () => now);
  const repairs = [
    { customerId: "staging-customer-a", repairNumber: "1842", vehicle: "Fictional Ford F-150 A", status: "diagnosis", scheduledStart: null, scheduledEnd: null },
    { customerId: "staging-customer-b", repairNumber: "2842", vehicle: "Fictional customer B vehicle", status: "diagnosis", scheduledStart: null, scheduledEnd: null }
  ];
  const project = ({ customerId: _customerId, ...repair }: (typeof repairs)[number]) => repair;
  const customer = createCustomerHttp({ auth, experience: {
    listRepairs: async principal => repairs.filter(row => row.customerId === principal.customerId).map(project),
    getRepair: async (principal, number) => {
      const row = repairs.find(row => row.repairNumber === number && row.customerId === principal.customerId);
      if (!row) throw new FloError({ code: "REPAIR_UNAVAILABLE", message: "That repair is not available for your account.", retryable: false });
      return project(row);
    },
    getEstimate: async () => { throw new FloError({ code: "ESTIMATE_NOT_READY", message: "Estimate is not ready.", retryable: true }); }
  } });
  const http = createEnrollmentHttp(enrollment, config.publicOrigin, customer);
  const call = (path: string, session: string, body: unknown, headers: Record<string, string> = {}) => http(new Request(config.publicOrigin + path, {
    method: "POST", headers: { origin: config.publicOrigin, "content-type": "application/json", cookie: `__Host-flo-session=${session}`, ...headers }, body: JSON.stringify(body)
  }), "192.0.2.2");
  const login = async (subject = "amazon-a") => {
    const start = await auth.begin("192.0.2.2");
    return auth.finish(new URL(start.authorizationUrl).searchParams.get("state")!, start.browserNonce, subject);
  };
  const request = async (session: string) => {
    const response = await call("/enrollment/request", session, { consent: true }); assert.equal(response.status, 200);
    const data = await response.json() as { requestCode: string; expiresAt: number };
    assert.doesNotMatch(JSON.stringify(data), /amazon-a|accessToken|sessionKey|revision|customerId/);
    return data;
  };
  const approve = (requestCode: string) => enrollment.approve("local-operator-capability", { requestCode, customerId: "staging-customer-a", verification });
  const prepare = async () => { const session = await login(); const started = await request(session); const approved = await approve(started.requestCode); return { session, body: { requestCode: started.requestCode, invitation: approved.invitation, consent: true } }; };
  return { store, provider, auth, enrollment, transactions, http, call, login, request, approve, prepare, expire: (ms = 300_001) => { now += ms; } };
}

describe("local customer pairing (synthetic provider and atomic local adapter, not hosted enrollment)", () => {
  it("serves pairing assets only through the opt-in wrapper with strict browser headers", async () => {
    const f = fixture();
    for (const path of ["/pairing", "/pairing.js"]) {
      const response = await f.http(new Request(config.publicOrigin + path), "192.0.2.2");
      assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
      assert.match(response.headers.get("content-security-policy")!, /frame-ancestors 'none'/);
      assert.doesNotMatch(response.headers.get("content-security-policy")!, /unsafe-inline|unsafe-eval/);
      assert.equal((await f.call(path, "", {})).status, 405);
      assert.equal((await f.http(new Request("https://wrong.example" + path), "192.0.2.2")).status, 403);
    }
  });
  it("keeps authentication separate from ownership and uses MCP to read A but not B after operator-approved pairing", async () => {
    const f = fixture(); const p = await f.prepare();
    await assert.rejects(f.auth.principal(p.session), /not linked/);
    assert.equal((await f.call("/api/customer/command", p.session, { command: "Show repair 1842" })).status, 403);
    const paired = await f.call("/enrollment/redeem", p.session, p.body);
    assert.equal(paired.status, 200); assert.equal(paired.headers.get("cache-control"), "no-store");
    assert.equal((await f.auth.principal(p.session)).customerId, "staging-customer-a");
    const own = await f.call("/api/customer/command", p.session, { command: "Show repair 1842" });
    assert.match(await own.text(), /get_my_repair.*Fictional Ford|Fictional Ford.*get_my_repair/);
    const other = await f.call("/api/customer/command", p.session, { command: "Show repair 2842" });
    const unknown = await f.call("/api/customer/command", p.session, { command: "Show repair 9999" });
    assert.equal(await other.text(), await unknown.text());
    const listing = await f.call("/api/customer/command", p.session, { command: "Show my repairs" });
    const list = await listing.text(); assert.match(list, /1842/); assert.doesNotMatch(list, /2842|customer B/);
    assert.deepEqual(f.store.auditForTest().map(row => row.action), ["operator_approved", "link_created"]);
  });
  it("requires independent operator credentials and a customer-scoped grant", async () => {
    const f = fixture(); const session = await f.login(); const r = await f.request(session);
    for (const credential of [session, "AWS4-HMAC-SHA256", "Administrator", ""]) await assert.rejects(f.enrollment.approve(credential, { requestCode: r.requestCode, customerId: "staging-customer-a", verification }));
    await assert.rejects(f.enrollment.approve("local-operator-capability", { requestCode: r.requestCode, customerId: "staging-customer-b", verification }));
    assert.equal((await f.call("/enrollment/approve", session, { requestCode: r.requestCode, customerId: "staging-customer-a", verification })).status, 404);
    assert.equal(f.store.auditForTest().length, 0);
  });
  it("rejects invitation theft by another signed-in account or a replacement session", async () => {
    const f = fixture(); const p = await f.prepare();
    for (const session of [await f.login("amazon-b"), await f.login("amazon-a")]) assert.equal((await f.call("/enrollment/redeem", session, p.body)).status, 403);
    assert.equal((await f.call("/enrollment/redeem", p.session, p.body)).status, 200);
    assert.equal(f.store.auditForTest().filter(row => row.action === "link_created").length, 1);
  });
  it("consumes an invitation once under concurrent redemption and rejects replay", async () => {
    const f = fixture(); const p = await f.prepare();
    const responses = await Promise.all(Array.from({ length: 8 }, () => f.call("/enrollment/redeem", p.session, p.body)));
    assert.equal(responses.filter(response => response.status === 200).length, 1);
    assert.equal(responses.filter(response => response.status === 403).length, 7);
    assert.equal((await f.call("/enrollment/redeem", p.session, p.body)).status, 403);
  });
  it("expires invitations before TTL cleanup and never converts a revoked link into a new grant", async () => {
    const f = fixture(); const p = await f.prepare(); f.expire();
    assert.equal((await f.call("/enrollment/redeem", p.session, p.body)).status, 403);
    await assert.rejects(f.auth.principal(p.session), /not linked/);
    const g = fixture(); const q = await g.prepare(); assert.equal((await g.call("/enrollment/redeem", q.session, q.body)).status, 200);
    g.store.revokeForTest(config.clientId, "amazon-a");
    await assert.rejects(g.auth.principal(q.session), /not linked/);
    assert.equal((await g.call("/enrollment/redeem", q.session, q.body)).status, 403);
    assert.equal((await g.call("/enrollment/request", q.session, { consent: true })).status, 403);
  });
  it("checks session deletion atomically at redemption, even after identity validation finishes", async () => {
    const f = fixture(); const p = await f.prepare();
    const original = f.transactions.redeem.bind(f.transactions);
    f.transactions.redeem = async (...args) => { await f.auth.logout(p.session); return original(...args); };
    assert.equal((await f.call("/enrollment/redeem", p.session, p.body)).status, 403);
    assert.equal(await f.store.findCustomer(config.clientId, "amazon-a"), undefined);
    assert.equal(f.store.auditForTest().filter(row => row.action === "link_created").length, 0);
  });
  it("blocks approval after logout and rejects expired or provider-revoked credentials", async () => {
    const f = fixture(); const session = await f.login(); const r = await f.request(session); await f.auth.logout(session);
    await assert.rejects(f.approve(r.requestCode));
    const g = fixture(); const p = await g.prepare(); g.expire(901_000);
    assert.equal((await g.call("/enrollment/redeem", p.session, p.body)).status, 401);
    const h = fixture(); const q = await h.prepare();
    h.provider.subject = async () => { throw new CustomerAuthError(401, "SIGN_IN_REQUIRED"); };
    assert.equal((await h.call("/enrollment/redeem", q.session, q.body)).status, 401);
    assert.equal(await h.store.findCustomer(config.clientId, "amazon-a"), undefined);
  });
  it("rejects identity overrides, wrong purpose, bad consent, wrong origin, duplicate cookies and service credentials", async () => {
    const f = fixture(); const p = await f.prepare();
    for (const extra of [{ customerId: "staging-customer-b" }, { amazonUserId: "amazon-b" }, { purpose: "repair_access" }, { consent: false }]) assert.equal((await f.call("/enrollment/redeem", p.session, { ...p.body, ...extra })).status, 400);
    assert.equal((await f.call("/enrollment/redeem", p.session, p.body, { origin: "https://attacker.invalid" })).status, 403);
    assert.equal((await f.call("/enrollment/redeem", p.session, p.body, { cookie: `__Host-flo-session=${p.session}; __Host-flo-session=${p.session}` })).status, 401);
    for (const session of ["", "AWS4-HMAC-SHA256", "amazon-a", "x".repeat(43)]) assert.equal((await f.call("/enrollment/redeem", session, p.body)).status, 401);
    assert.equal((await f.call("/enrollment/redeem", p.session, { ...p.body, invitation: p.body.requestCode })).status, 403);
    assert.equal((await f.call("/enrollment/redeem", p.session, { ...p.body, invitation: "x".repeat(43) })).status, 403);
    assert.equal((await f.call("/enrollment/request", p.session, { consent: true, padding: "x".repeat(2100) })).status, 413);
    assert.equal((await f.call("/enrollment/redeem", p.session, p.body)).status, 200);
  });
  it("does not extend request lifetime on approval and limits one active request per identity", async () => {
    const f = fixture(); const session = await f.login(); const r = await f.request(session);
    assert.equal((await f.call("/enrollment/request", session, { consent: true })).status, 403);
    f.expire(299_000); const approved = await f.approve(r.requestCode); f.expire(1001);
    assert.equal((await f.call("/enrollment/redeem", session, { requestCode: r.requestCode, invitation: approved.invitation, consent: true })).status, 403);
    assert.equal((await f.call("/enrollment/request", session, { consent: true })).status, 200);
  });
  it("fails closed when transactional storage fails, without claiming a completed link", async () => {
    const f = fixture(); const p = await f.prepare();
    f.transactions.redeem = async () => { throw new Error("storage unavailable secret details"); };
    const response = await f.call("/enrollment/redeem", p.session, p.body);
    assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /secret details|linked/);
    assert.equal(await f.store.findCustomer(config.clientId, "amazon-a"), undefined);
  });
  it("revokes actual customer HTTP access on logout after successful pairing", async () => {
    const f = fixture(); const p = await f.prepare();
    assert.equal((await f.call("/enrollment/redeem", p.session, p.body)).status, 200);
    assert.equal((await f.call("/auth/logout", p.session, {})).status, 200);
    const response = await f.call("/api/customer/command", p.session, { command: "Show repair 1842" });
    assert.equal(response.status, 401); assert.doesNotMatch(await response.text(), /Fictional Ford|data/);
  });
  it("rejects expired or repeated operator approval and validates pairing HTTP boundaries", async () => {
    const f = fixture(); const p = await f.prepare();
    await assert.rejects(f.approve(p.body.requestCode));
    const session = await f.login("amazon-b"); const r = await f.request(session); f.expire();
    await assert.rejects(f.approve(r.requestCode));
    assert.equal((await f.http(new Request(config.publicOrigin + "/enrollment/request"), "192.0.2.2")).status, 405);
    assert.equal((await f.call("/enrollment/request", session, { consent: true }, { "content-type": "text/plain" })).status, 415);
    assert.throws(() => createEnrollmentHttp(f.enrollment, "http://flo.example", f.http));
    assert.throws(() => createEnrollmentHttp(f.enrollment, config.publicOrigin + "/", f.http));
  });
});
