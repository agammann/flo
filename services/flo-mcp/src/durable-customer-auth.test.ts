import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CustomerAuthError, type LwaProvider } from "@flo/agent";
import { DurableCustomerWebsiteAuth, type AtomicAuthStore, type StoredAuthRecord } from "./durable-customer-auth.js";

export class TestAtomicAuthStore implements AtomicAuthStore {
  readonly rows = new Map<string, StoredAuthRecord>();
  async read(key: string) { return structuredClone(this.rows.get(key)); }
  async write(key: string, expected: string | undefined, record: StoredAuthRecord) {
    if (this.rows.get(key)?.revision !== expected) return false;
    this.rows.set(key, structuredClone(record)); return true;
  }
  async remove(key: string) { this.rows.delete(key); }
}
const config = { clientId: "durable-test", clientSecret: "synthetic-test-only", publicOrigin: "https://flo.example" };
const fixture = () => {
  let now = 1_000; let exchanges = 0;
  const store = new TestAtomicAuthStore();
  const links = new Map([["one", "customer-001"], ["two", "customer-002"]]);
  const provider: LwaProvider = { exchange: async code => { exchanges++; return { accessToken: code, subject: code, expiresIn: 60 }; }, subject: async token => token };
  const create = () => new DurableCustomerWebsiteAuth(config, provider, { findCustomer: async (_client, subject) => links.get(subject) }, store, () => now);
  const first = create(); const second = create();
  const start = async () => { const login = await first.begin("192.0.2.10"); return { state: new URL(login.authorizationUrl).searchParams.get("state")!, nonce: login.browserNonce }; };
  const login = async (subject = "one") => { const flow = await start(); return second.finish(flow.state, flow.nonce, subject); };
  return { first, second, create, start, login, store, provider, links, exchanges: () => exchanges, expire: (ms = 61_000) => { now += ms; } };
};

describe("durable customer auth across instances (atomic store contract)", () => {
  it("starts on one instance, finishes on another and survives a new auth instance", async () => {
    const f = fixture(); const session = await f.login();
    assert.equal((await f.create().principal(session)).customerId, "customer-001");
    assert.ok([...f.store.rows.keys()].every(key => !key.includes(session)));
    assert.ok(!JSON.stringify([...f.store.rows.keys()]).includes("192.0.2.10"));
  });
  it("consumes state atomically under concurrent callbacks and never exchanges twice", async () => {
    const f = fixture(); const flow = await f.start();
    const result = await Promise.allSettled([f.first.finish(flow.state, flow.nonce, "one"), f.second.finish(flow.state, flow.nonce, "one")]);
    assert.equal(result.filter(item => item.status === "fulfilled").length, 1); assert.equal(f.exchanges(), 1);
    await assert.rejects(f.create().finish(flow.state, flow.nonce, "one"), /sign in/);
  });
  it("does not consume correct state for the wrong browser; expires even before TTL cleanup", async () => {
    const f = fixture(); const flow = await f.start();
    await assert.rejects(f.second.finish(flow.state, "x".repeat(43), "one"), /sign in/);
    assert.equal(f.exchanges(), 0);
    f.expire(300_001);
    await assert.rejects(f.second.finish(flow.state, flow.nonce, "one"), /sign in/);
    assert.ok(f.store.rows.size > 0, "test deliberately leaves expired TTL records present");
  });
  it("revokes across instances and does not let an in-flight principal resurrect a logged-out session", async () => {
    const f = fixture(); const session = await f.login();
    let release: (value: string) => void = () => undefined; let started: () => void = () => undefined;
    const waiting = new Promise<void>(resolve => { started = resolve; });
    f.provider.subject = () => new Promise(resolve => { release = resolve; started(); });
    const pending = f.first.principal(session); await waiting;
    await f.second.logout(session); release("one");
    await assert.rejects(pending, /sign in/);
    await assert.rejects(f.create().principal(session), /sign in/);
  });
  it("rejects unlinked, expired, revoked, service and wrong-application credentials", async () => {
    const f = fixture(); const one = await f.login(); const two = await f.login("two");
    assert.equal((await f.first.principal(two)).customerId, "customer-002");
    f.links.delete("one"); await assert.rejects(f.first.principal(one), /not linked/);
    for (const token of ["one", "AWS4-HMAC-SHA256", "service-token", "x".repeat(43)]) await assert.rejects(f.first.principal(token), /sign in/);
    const otherApp = new DurableCustomerWebsiteAuth({ ...config, clientId: "different-app" }, f.provider, { findCustomer: async () => "customer-001" }, f.store);
    await assert.rejects(otherApp.principal(two), /sign in/);
    f.expire(); await assert.rejects(f.second.principal(two), /sign in/);
    const fresh = await f.login("two");
    f.provider.subject = async () => { throw new CustomerAuthError(401, "SIGN_IN_REQUIRED"); };
    await assert.rejects(f.first.principal(fresh), /sign in/); await assert.rejects(f.second.principal(fresh), /sign in/);
  });
  it("shares admission limits across instances, retires replaced state, and recovers after expiry", async () => {
    const f = fixture(); let previous = "";
    for (let i = 0; i < 20; i++) previous = (await (i % 2 ? f.first : f.second).begin("192.0.2.2", previous)).browserNonce;
    await assert.rejects(f.create().begin("::ffff:192.0.2.2", previous), error => error instanceof CustomerAuthError && error.status === 429);
    for (let i = 0; i < 5; i++) await f.first.begin("192.0.2.3");
    await assert.rejects(f.second.begin("192.0.2.3"), error => error instanceof CustomerAuthError && error.status === 429);
    f.expire(300_001); assert.ok((await f.second.begin("192.0.2.2")).authorizationUrl);
  });
  it("does not issue a session when exchange fails or storage cannot acknowledge the session write", async () => {
    const f = fixture(); const flow = await f.start(); f.provider.exchange = async () => { throw new Error("provider failure"); };
    await assert.rejects(f.first.finish(flow.state, flow.nonce, "one"));
    await assert.rejects(f.second.finish(flow.state, flow.nonce, "one"), /sign in/);
    const g = fixture(); const next = await g.start(); const original = g.store.write.bind(g.store);
    g.store.write = async (key, expected, value) => { if (key.includes(":session:")) throw new Error("write unavailable"); return original(key, expected, value); };
    await assert.rejects(g.first.finish(next.state, next.nonce, "one"));
    assert.ok([...g.store.rows.keys()].every(key => !key.includes(":session:")));
  });
});
