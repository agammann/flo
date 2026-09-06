import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { CustomerWebsiteAuth, CustomerAuthError } from "@flo/agent";
import { createCustomerWebsite } from "@flo/mcp";
import { createShopApi } from "@flo/mock-shop-api";
import { createHttpAdapters } from "@flo/adapters";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const config = { clientId: "contract-test-client", clientSecret: "synthetic-test-only", publicOrigin: "https://flo.example" };
const listen = (server: Server): Promise<string> => new Promise(resolve => { server.listen(0, "127.0.0.1", () => { const address = server.address(); assert.ok(address && typeof address !== "string"); resolve(`http://127.0.0.1:${address.port}`); }); });
const close = (server: Server): Promise<void> => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));

describe("customer website sign-in and MCP authorization (simulated Amazon provider)", () => {
  let shopServer: Server; let site: Server; let base: string; let auth: CustomerWebsiteAuth;
  const revoked = new Set<string>(); const links = new Map([["owner-one", "customer-001"], ["owner-two", "customer-002"]]);
  let now = 1000;
  let adapters: ReturnType<typeof createHttpAdapters>;
  let beforeList: (() => Promise<void>) | undefined;
  before(async () => {
    const api = createShopApi(new Date("2026-09-05T12:00:00Z"));
    shopServer = api.app.listen(); await close(shopServer);
    const shopUrl = await listen(shopServer);
    adapters = createHttpAdapters({ shop: shopUrl, inventory: shopUrl, supplier: shopUrl, customer: shopUrl });
    const originalList = adapters.shop.listWorkOrders.bind(adapters.shop);
    adapters.shop.listWorkOrders = async () => { await beforeList?.(); return originalList(); };
    auth = new CustomerWebsiteAuth(config, {
      exchange: async code => ({ accessToken: code, subject: code, expiresIn: 60 }),
      subject: async token => { if (revoked.has(token)) throw new CustomerAuthError(401, "SIGN_IN_REQUIRED"); return token; }
    }, { findCustomer: async (_client, subject) => links.get(subject) }, () => now);
    site = createCustomerWebsite({ auth, shop: adapters.shop }); base = await listen(site);
  });
  after(async () => { await close(site); await close(shopServer); });
  const post = (path: string, body: unknown, cookie = "", origin = config.publicOrigin) => fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie }, body: JSON.stringify(body) });
  const login = async (identity: string) => {
    const start = await post("/auth/lwa/start", { consent: true }); assert.equal(start.status, 200);
    const nonce = start.headers.getSetCookie()[0]!.split(";")[0]!;
    const payload = await start.json() as { authorizationUrl: string };
    const state = new URL(payload.authorizationUrl).searchParams.get("state")!;
    const callback = await fetch(`${base}/auth/lwa/callback?${new URLSearchParams({ state, code: identity })}`, { headers: { Cookie: nonce }, redirect: "manual" });
    assert.equal(callback.status, 303);
    const setCookie = callback.headers.getSetCookie().find(item => item.startsWith("__Host-flo-session="))!;
    assert.match(setCookie, /Secure; HttpOnly; SameSite=Strict/);
    return setCookie.split(";")[0]!;
  };
  it("signs in, maps only trusted identity, and executes the real read-only MCP tool through structured shop HTTP", async () => {
    const cookie = await login("owner-one");
    const session = await fetch(`${base}/auth/session`, { headers: { Cookie: cookie } });
    assert.deepEqual(await session.json(), { signedIn: true, linked: true });
    const result = await post("/api/customer/command", { command: "Status of repair 1842" }, cookie);
    assert.equal(result.status, 200);
    const data = await result.json() as { tools: string[]; data: { data: { repairNumber: string } } };
    assert.deepEqual(data.tools, ["get_my_repair"]);
    assert.equal(data.data.data.repairNumber, "1842");
    assert.doesNotMatch(JSON.stringify(data), /"(?:customerId|vin|margin|diagnosis|accessToken)":/i);
    assert.equal((await post("/api/customer/command", { command: "Show my repairs", customerId: "customer-002" }, cookie)).status, 400);
  });
  it("isolates two signed-in customers, including internal job IDs, and refuses identity header overrides", async () => {
    const cookies = await Promise.all([login("owner-one"), login("owner-two")]);
    const work = await adapters.shop.listWorkOrders(); const first = work.find(item => item.workOrderNumber === "1842")!;
    for (const [index, cookie] of cookies.entries()) {
      const client = new Client({ name: "owner-isolation", version: "1" }, { versionNegotiation: { mode: "legacy" } });
      try {
        await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/website/mcp`), { requestInit: { headers: { Origin: config.publicOrigin, Authorization: `Bearer ${cookie.split("=")[1]}`, "x-flo-customer-id": "customer-001", "x-flo-role": "administrator" } } }));
        assert.deepEqual((await client.listTools()).tools.map(tool => tool.name).sort(), ["get_my_estimate", "get_my_repair", "list_my_repairs"]);
        for (const repairNumber of [first.id, first.workOrderNumber]) {
          const result = await client.callTool({ name: "get_my_repair", arguments: { repairNumber } });
          assert.equal(result.isError === true, index === 1);
          if (index === 1) assert.doesNotMatch(JSON.stringify(result), /Ford|F-150/);
        }
        assert.equal((await client.callTool({ name: "list_my_repairs", arguments: { customerId: "customer-001" } })).isError, true);
      } finally { await client.close(); }
    }
  });
  it("rejects unlinked accounts, provider revocation, expiry, logout and credentials from other authorization domains", async () => {
    const unlinked = await login("unlinked");
    assert.equal((await post("/api/customer/command", { command: "Show my repairs" }, unlinked)).status, 403);
    const revokedCookie = await login("revoked-owner"); revoked.add("revoked-owner");
    assert.equal((await fetch(`${base}/auth/session`, { headers: { Cookie: revokedCookie } })).status, 401);
    const expired = await login("owner-one"); now += 61_000;
    assert.equal((await fetch(`${base}/auth/session`, { headers: { Cookie: expired } })).status, 401);
    const cookie = await login("owner-one");
    assert.equal((await post("/auth/logout", {}, cookie)).status, 200);
    assert.equal((await post("/api/customer/command", { command: "Show my repairs" }, cookie)).status, 401);
    for (const credential of ["Bearer service-token", "Bearer owner-one", "AWS4-HMAC-SHA256 synthetic"]) {
      const denied = await fetch(`${base}/website/mcp`, { method: "POST", headers: { Origin: config.publicOrigin, Authorization: credential, "x-flo-customer-id": "customer-001" } });
      assert.equal(denied.status, 401);
    }
  });
  it("does not equate website login with Alexa+ account linking or expose staff/demo endpoints", async () => {
    const cookie = await login("owner-one");
    for (const path of ["/mcp", "/alexa/mcp", "/customer/mcp"]) {
      const response = await fetch(`${base}${path}`, { headers: { Cookie: cookie, Authorization: `Bearer ${cookie.split("=")[1]}` } });
      assert.equal(response.status, 401);
      assert.match(await response.text(), /Official Alexa/);
    }
    for (const path of ["/shop", "/api/command", "/api/reset"]) assert.equal((await fetch(`${base}${path}`)).status, 404);
  });
  it("requires consent and exact origin and prevents login callback replay or browser substitution", async () => {
    assert.equal((await post("/auth/lwa/start", {})).status, 400);
    assert.equal((await post("/auth/lwa/start", { consent: true }, "", "https://attacker.example")).status, 403);
    const start = auth.begin("127.0.0.1"); const state = new URL(start.authorizationUrl).searchParams.get("state")!;
    const callbackUrl = `${base}/auth/lwa/callback?${new URLSearchParams({ state, code: "owner-one" })}`;
    assert.equal((await fetch(callbackUrl, { redirect: "manual" })).status, 401);
    const cookie = `__Host-flo-lwa-state=${start.browserNonce}`;
    assert.equal((await fetch(callbackUrl, { redirect: "manual", headers: { Cookie: cookie } })).status, 303);
    assert.equal((await fetch(callbackUrl, { redirect: "manual", headers: { Cookie: cookie } })).status, 401);
  });
  it("starts safely without credentials and never falls back to synthetic customer access", async () => {
    const disabled = createCustomerWebsite({ shop: adapters.shop }); const url = await listen(disabled);
    try {
      const page = await fetch(url); assert.equal(page.status, 200); assert.match(await page.text(), /Signing in identifies you/);
      assert.match(page.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
      assert.equal((await fetch(`${url}/auth/session`)).status, 503);
    } finally { await close(disabled); }
  });
  it("rejects rotating forwarded identities before provider calls and recovers after expiry", async () => {
    let calls = 0; let clock = 1000;
    const limited = new CustomerWebsiteAuth(config, {
      exchange: async () => { calls++; return { accessToken: "token", subject: "owner-one", expiresIn: 60 }; },
      subject: async () => "owner-one"
    }, { findCustomer: async () => "customer-001" }, () => clock);
    const isolated = createCustomerWebsite({ auth: limited, shop: adapters.shop }); const url = await listen(isolated);
    const start = (i: number) => fetch(`${url}/auth/lwa/start`, { method: "POST", headers: {
      Origin: config.publicOrigin, "Content-Type": "application/json", "X-Forwarded-For": `192.0.2.${i}`, Forwarded: `for=192.0.2.${i}`, "X-Flo-Client-IP": `192.0.2.${i}`
    }, body: JSON.stringify({ consent: true }) });
    try {
      for (let i = 0; i < 5; i++) assert.equal((await start(i)).status, 200);
      for (let i = 5; i < 25; i++) {
        const result = await start(i); assert.equal(result.status, 429); assert.equal(result.headers.get("retry-after"), "300");
      }
      assert.equal(calls, 0); clock += 300_001;
      assert.equal((await start(1)).status, 200);
    } finally { await close(isolated); }
  });
  it("isolates clients behind an explicitly trusted proxy and fails closed on invalid proxy identity", async () => {
    const proxied = new CustomerWebsiteAuth(config, { exchange: async () => { throw new Error("No provider calls expected"); }, subject: async () => "unused" }, { findCustomer: async () => undefined });
    const isolated = createCustomerWebsite({ auth: proxied, shop: adapters.shop, trustedProxyAddresses: ["127.0.0.1"] }); const url = await listen(isolated);
    const start = (ip?: string) => fetch(`${url}/auth/lwa/start`, { method: "POST", headers: { Origin: config.publicOrigin, "Content-Type": "application/json", ...(ip === undefined ? {} : { "X-Flo-Client-IP": ip }) }, body: JSON.stringify({ consent: true }) });
    try {
      for (let i = 0; i < 5; i++) assert.equal((await start("192.0.2.1")).status, 200);
      assert.equal((await start("192.0.2.1")).status, 429);
      assert.equal((await start("192.0.2.2")).status, 200, "another customer behind the same trusted proxy can still sign in");
      for (const ip of [undefined, "not-an-ip", "192.0.2.2, 192.0.2.3", "https://192.0.2.2"]) assert.equal((await start(ip)).status, 503);
    } finally { await close(isolated); }
  });
  it("suppresses in-flight direct MCP results after logout, expiry, unlink or customer reassignment", async () => {
    for (const change of ["logout", "expire", "unlink", "reassign"] as const) {
      const cookie = await login("owner-one"); const session = cookie.split("=")[1]!;
      let release: () => void = () => undefined; let started: () => void = () => undefined;
      const waiting = new Promise<void>(resolve => { started = resolve; });
      beforeList = () => new Promise<void>(resolve => { release = resolve; started(); });
      const client = new Client({ name: "inflight-revocation", version: "1" }, { versionNegotiation: { mode: "legacy" } });
      try {
        await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/website/mcp`), { requestInit: { headers: { Origin: config.publicOrigin, Authorization: `Bearer ${session}` } } }));
        const pending = client.callTool({ name: "list_my_repairs", arguments: {} }); await waiting;
        if (change === "logout") auth.logout(session);
        if (change === "expire") now += 61_000;
        if (change === "unlink") links.delete("owner-one");
        if (change === "reassign") links.set("owner-one", "customer-002");
        release(); const result = await pending;
        assert.equal(result.isError, true);
        assert.doesNotMatch(JSON.stringify(result), /Ford|F-150|1842|"data":/);
      } finally { release(); beforeList = undefined; links.set("owner-one", "customer-001"); await client.close(); }
    }
  });
  it("does not return the former customer's BFF data when the trusted link is reassigned mid-request", async () => {
    const cookie = await login("owner-one");
    let release: () => void = () => undefined; let started: () => void = () => undefined;
    const waiting = new Promise<void>(resolve => { started = resolve; });
    beforeList = () => new Promise<void>(resolve => { release = resolve; started(); });
    try {
      const pending = post("/api/customer/command", { command: "Show my repairs" }, cookie); await waiting;
      links.set("owner-one", "customer-002"); release();
      const result = await pending;
      assert.equal(result.status, 401);
      assert.doesNotMatch(await result.text(), /Ford|F-150|1842|"data":/);
    } finally { release(); beforeList = undefined; links.set("owner-one", "customer-001"); }
  });
});
