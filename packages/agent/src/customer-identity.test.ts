import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CustomerWebsiteAuth, CustomerAuthError, FileCustomerLinkStore, createLwaProvider, validateLwaConfig, type LwaProvider } from "./customer-identity.js";

const config = { clientId: "test-client", clientSecret: "synthetic-test-secret", publicOrigin: "https://flo.example" };
const fixture = () => {
  let time = 1000; let linked = true; let valid = true;
  const provider: LwaProvider = { exchange: async () => ({ accessToken: "synthetic-token", subject: "amazon-owner", expiresIn: 60 }), subject: async () => { if (!valid) throw new CustomerAuthError(401, "SIGN_IN_REQUIRED"); return "amazon-owner"; } };
  const auth = new CustomerWebsiteAuth(config, provider, { findCustomer: async (clientId, subject) => linked && clientId === config.clientId && subject === "amazon-owner" ? "customer-001" : undefined }, () => time);
  const login = async () => { const start = auth.begin("127.0.0.1"); return auth.finish(new URL(start.authorizationUrl).searchParams.get("state")!, start.browserNonce, "synthetic-code-long-enough"); };
  return { auth, provider, login, expire: () => { time += 61_000; }, unlink: () => { linked = false; }, revoke: () => { valid = false; } };
};
describe("Login with Amazon website identity", () => {
  it("one source cannot fill the global login pool, including mapped IP aliases", async () => {
    const f = fixture(); let exchanges = 0;
    f.provider.exchange = async () => { exchanges++; return { accessToken: "token", subject: "amazon-owner", expiresIn: 60 }; };
    for (let i = 0; i < 5; i++) f.auth.begin("192.0.2.1");
    for (let i = 0; i < 1000; i++) assert.throws(() => f.auth.begin(i % 2 ? "::ffff:192.0.2.1" : "192.0.2.1"), error => error instanceof CustomerAuthError && error.status === 429);
    const next = f.auth.begin("192.0.2.2");
    await f.auth.finish(new URL(next.authorizationUrl).searchParams.get("state")!, next.browserNonce, "valid-test-code");
    assert.equal(exchanges, 1);
  });
  it("retires superseded browser state but charges replacements to the source rate limit", async () => {
    const f = fixture(); const first = f.auth.begin("192.0.2.1");
    let latest = first;
    for (let i = 1; i < 20; i++) latest = f.auth.begin("192.0.2.1", latest.browserNonce);
    await assert.rejects(f.auth.finish(new URL(first.authorizationUrl).searchParams.get("state")!, first.browserNonce, "valid-test-code"), /sign in/);
    assert.throws(() => f.auth.begin("192.0.2.1", latest.browserNonce), error => error instanceof CustomerAuthError && error.status === 429);
    const session = await f.auth.finish(new URL(latest.authorizationUrl).searchParams.get("state")!, latest.browserNonce, "valid-test-code");
    assert.equal((await f.auth.principal(session)).customerId, "customer-001");
    for (let i = 0; i < 5; i++) f.expire();
    assert.ok(f.auth.begin("192.0.2.1").authorizationUrl);
  });
  it("bounds the admission map and releases it after expiry", () => {
    const f = fixture();
    for (let i = 0; i < 1000; i++) f.auth.begin(`source-${i}`);
    assert.throws(() => f.auth.begin("new-source"), /unavailable/);
    for (let i = 0; i < 5; i++) f.expire();
    assert.ok(f.auth.begin("new-source").authorizationUrl);
  });
  it("requests minimum scope with browser-bound state, PKCE and canonical HTTPS callback", async () => {
    const f = fixture(); let verifier = "";
    f.provider.exchange = async (_code, value) => { verifier = value; return { accessToken: "token", subject: "amazon-owner", expiresIn: 60 }; };
    const start = f.auth.begin("127.0.0.1"); const url = new URL(start.authorizationUrl);
    assert.equal(url.origin, "https://www.amazon.com");
    assert.equal(url.searchParams.get("scope"), "profile:user_id");
    assert.equal(url.searchParams.get("redirect_uri"), "https://flo.example/auth/lwa/callback");
    await assert.rejects(f.auth.finish(url.searchParams.get("state")!, "wrong-browser", "synthetic-code-long-enough"), /sign in/);
    const session = await f.auth.finish(url.searchParams.get("state")!, start.browserNonce, "synthetic-code-long-enough");
    assert.equal(url.searchParams.get("code_challenge"), createHash("sha256").update(verifier).digest("base64url"));
    assert.equal((await f.auth.principal(session)).customerId, "customer-001");
    await assert.rejects(f.auth.finish(url.searchParams.get("state")!, start.browserNonce, "synthetic-code-long-enough"), /sign in/);
  });
  it("denies arbitrary service credentials and raw Amazon tokens", async () => {
    const f = fixture(); await f.login();
    for (const value of ["", "service-token", "AWS4-HMAC-SHA256", "synthetic-token"]) await assert.rejects(f.auth.principal(value), /sign in/);
  });
  it("denies expired sessions, revoked credentials, and logged-out sessions", async () => {
    for (const action of ["expire", "revoke", "logout"] as const) {
      const f = fixture(); const session = await f.login();
      if (action === "logout") f.auth.logout(session); else f[action]();
      await assert.rejects(f.auth.principal(session), /sign in/);
    }
  });
  it("requires an explicit trusted link and immediately honors link removal", async () => {
    const f = fixture(); const session = await f.login();
    f.unlink();
    await assert.rejects(f.auth.principal(session), error => error instanceof CustomerAuthError && error.code === "CUSTOMER_NOT_LINKED");
    const second = await f.login();
    await assert.rejects(f.auth.principal(second), /not linked/);
  });
  it("logout wins over an in-flight identity lookup", async () => {
    const f = fixture(); const session = await f.login(); let finish: (value: string) => void = () => undefined;
    f.provider.subject = () => new Promise(resolve => { finish = resolve; });
    const request = f.auth.principal(session); f.auth.logout(session); finish("amazon-owner");
    await assert.rejects(request, /sign in/);
  });
  it("rejects insecure or noncanonical configuration", () => {
    for (const publicOrigin of ["http://flo.example", "https://flo.example/", "https://flo.example/path", "https://user:pass@flo.example"]) assert.throws(() => validateLwaConfig({ ...config, publicOrigin }), /unavailable/);
    assert.throws(() => validateLwaConfig({ ...config, clientId: "é".repeat(51) }), /unavailable/);
    for (const clientSecret of ["", " ", " secret", "secret ", "secret\n", "secret\0", "é", "x".repeat(1025)]) {
      assert.throws(() => validateLwaConfig({ ...config, clientSecret }), error => error instanceof CustomerAuthError && error.code === "SIGN_IN_UNAVAILABLE" && error.message === "Customer sign-in is temporarily unavailable.");
    }
  });
  it("accepts bounded opaque credentials without truncating or stripping provider prefixes", () => {
    for (const clientSecret of ["x".repeat(64), "x".repeat(65), "amzn1.oa2-cs.v1." + "a".repeat(64), "x".repeat(1024)]) {
      assert.equal(validateLwaConfig({ ...config, clientSecret }).clientSecret, clientSecret);
    }
  });
  it("verifies code exchange, app audience and Amazon user ID with mocked official HTTP contracts", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    let audience = config.clientId;
    const request: typeof fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : input.toString(); calls.push({ url, ...(init ? { init } : {}) });
      if (url.endsWith("/token")) return Response.json({ access_token: "synthetic-token", token_type: "bearer", expires_in: 3600 });
      if (url.includes("/tokeninfo?")) return Response.json({ aud: audience });
      return Response.json({ user_id: "amazon-owner", email: "must-not-be-used@example.test", name: "Do not retain" });
    };
    const prefixedConfig = { ...config, clientSecret: "amzn1.oa2-cs.v1." + "a".repeat(64) };
    const provider = createLwaProvider(prefixedConfig, request);
    assert.deepEqual(await provider.exchange("synthetic-code-long-enough", "a".repeat(43)), { accessToken: "synthetic-token", expiresIn: 3600, subject: "amazon-owner" });
    const rawBody = calls[0]?.init?.body; assert.equal(typeof rawBody, "string");
    const body = new URLSearchParams(rawBody as string);
    assert.equal(body.get("client_secret"), prefixedConfig.clientSecret);
    assert.equal(body.get("client_id"), config.clientId);
    assert.equal(body.get("code_verifier"), "a".repeat(43));
    assert.equal(body.get("redirect_uri"), `${config.publicOrigin}/auth/lwa/callback`);
    assert.equal(calls[2]?.init?.headers && new Headers(calls[2].init.headers).get("Authorization"), "Bearer synthetic-token");
    audience = "another-app";
    await assert.rejects(provider.exchange("synthetic-code-long-enough", "a".repeat(43)), /sign in/);
  });
  it("fails closed on rejected, malformed, oversized or redirected provider responses without leaking details", async () => {
    for (const response of [new Response("private provider detail", { status: 401 }), Response.json({ email: "no-id@example.test" }), new Response("x".repeat(33_000)), new Response(null, { status: 302 })]) {
      const provider = createLwaProvider(config, async () => response);
      await assert.rejects(provider.subject("synthetic-token"), error => error instanceof CustomerAuthError && !/private|example.test|synthetic/.test(error.message));
    }
  });
  it("loads only exact operator-maintained links and rejects duplicate or wrong-app records", async () => {
    const directory = await mkdtemp(join(tmpdir(), "flo-identity-test-")); const file = join(directory, "bindings.json");
    const store = new FileCustomerLinkStore(file);
    const link = { amazonUserId: "verified-id", customerId: "customer-001", active: true };
    try {
      await writeFile(file, JSON.stringify({ version: 1, clientId: config.clientId, links: [link] }));
      assert.equal(await store.findCustomer(config.clientId, "verified-id"), "customer-001");
      assert.equal(await store.findCustomer(config.clientId, "same-email-is-not-identity"), undefined);
      await assert.rejects(store.findCustomer("wrong-app", "verified-id"), /unavailable/);
      await writeFile(file, JSON.stringify({ version: 1, clientId: config.clientId, links: [{ ...link, active: false }] }));
      assert.equal(await store.findCustomer(config.clientId, "verified-id"), undefined);
      await writeFile(file, JSON.stringify({ version: 1, clientId: config.clientId, links: [link, { ...link, customerId: "customer-002" }] }));
      await assert.rejects(store.findCustomer(config.clientId, "verified-id"), /unavailable/);
    } finally { await unlink(file).catch(() => undefined); await rmdir(directory); }
  });
});
