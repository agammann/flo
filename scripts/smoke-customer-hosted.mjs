import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

// Bounded, credential-free checks for this reviewed, login-disabled staging release.
// These do not establish real Login with Amazon or customer ownership authorization.
const origin = "https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com";
assert.equal(process.argv[2], origin, "Explicit approved staging origin required");
const hashes = {
  "/": "62b65ca8f3a90e92892fc60cae6d5cc90168a457179186c1cbd0307dc2372433",
  "/privacy": "3d491f9fd3200bc13957a7df5fead09f95ee6cef6a965fe47fa143c539c97d90",
  "/terms": "c94adc6f7c2379ff52c580157ef26f99de59f5fef96c305a2b2519435b53f9e3",
  "/signin.js": "f6bcd232457bd11f67117ba8ef82e562a31ec0659df26ef01e925fa56e442e21",
  "/signin.css": "a6abcf1047aff331e2b47d5e8d7321d88ddc151a2505b71a60d43d08e8f75ac2"
};
const cases = [
  ...Object.keys(hashes).map(path => ({ path, status: 200 })),
  { path: "/auth/session", status: 503 },
  { path: "/auth/session", status: 503, headers: { Cookie: "__Host-flo-session=invalid-staging-test" } },
  { path: "/auth/lwa/callback?state=synthetic&code=synthetic", status: 503 },
  { path: "/auth/lwa/start", method: "POST", status: 403, body: { consent: true } },
  { path: "/auth/logout", method: "POST", status: 403, body: {} },
  { path: "/api/customer/command", method: "POST", status: 403, body: { command: "show repair 1842" } },
  { path: "/api/customer/command", method: "POST", status: 403, body: { command: "show repair 1842" }, headers: { Origin: "https://example.invalid", "X-Shop-Role": "Administrator" } },
  { path: "/website/mcp", method: "POST", status: 403, body: {}, headers: { Authorization: "Bearer synthetic-not-a-credential" } },
  { path: "/alexa/mcp", status: 401 },
  { path: "/customer/mcp", status: 401 },
  { path: "/mcp", status: 401 }
];
for (const test of cases) {
  const response = await globalThis.fetch(`${origin}${test.path}`, {
    method: test.method ?? "GET", redirect: "manual", signal: globalThis.AbortSignal.timeout(15000),
    headers: { Origin: origin, ...(test.body ? { "Content-Type": "application/json" } : {}), ...test.headers },
    ...(test.body ? { body: JSON.stringify(test.body) } : {})
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  assert.equal(response.status, test.status, `${test.method ?? "GET"} ${test.path}`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.match(response.headers.get("strict-transport-security") ?? "", /max-age=31536000/);
  assert.equal(response.headers.getSetCookie().length, 0, "Disabled login must not create session cookies");
  assert.equal(response.headers.get("location"), null, "No Amazon sign-in redirect while disabled");
  if (Object.hasOwn(hashes, test.path)) assert.equal(digest, hashes[test.path]);
  if (test.path === "/privacy") {
    assert.match(bytes.toString(), /Alexander Ammann/);
    assert.match(bytes.toString(), /xyes47314@gmail\.com/);
  }
  console.log(JSON.stringify({ method: test.method ?? "GET", path: test.path, status: response.status, bytes: bytes.length, sha256: digest, requestId: response.headers.get("apigw-requestid"), securityHeaders: "pass", variant: test.headers ? "synthetic-header" : "ordinary" }));
  await delay(1100);
}
console.log("HOSTED_DISABLED_LOGIN_SMOKE_PASS: 16 checks; no real credentials, customer records, or Amazon provider calls.");
