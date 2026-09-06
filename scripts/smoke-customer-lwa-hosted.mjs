import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

// Explicitly approved staging only. No cookie jar, real credentials, provider
// exchange, login initiation, customer mapping writes or repair mutations.
const origin = "https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com";
assert.equal(process.argv[2], origin, "Explicit approved staging origin required");
const hashes = {
  "/": "ab3f9b2ab552fdeb2d85103dd5ccce25b93073c4db77acd1eda8c4f0508d7581",
  "/privacy": "3d491f9fd3200bc13957a7df5fead09f95ee6cef6a965fe47fa143c539c97d90",
  "/terms": "c94adc6f7c2379ff52c580157ef26f99de59f5fef96c305a2b2519435b53f9e3",
  "/signin.js": "c5d092c2aa8d1b0e48144aad037118b3a795b6fecb02dc5063c0541f2e2fdfff",
  "/signin.css": "a6abcf1047aff331e2b47d5e8d7321d88ddc151a2505b71a60d43d08e8f75ac2"
};
const cases = [
  ...Object.keys(hashes).map(path => ({ path, status: 200 })),
  { path: "/auth/session", status: 401 },
  { path: "/auth/session", status: 401, headers: { Cookie: `__Host-flo-session=${"z".repeat(43)}` } },
  { path: "/auth/lwa/callback?state=synthetic&code=synthetic", status: 401 },
  { path: "/auth/lwa/start", method: "POST", status: 400, body: { consent: false } },
  { path: "/auth/lwa/start", method: "POST", status: 403, body: { consent: true }, headers: { Origin: "https://example.invalid" } },
  { path: "/api/customer/command", method: "POST", status: 401, body: { command: "show repair 1842" } },
  { path: "/api/customer/command", method: "POST", status: 401, body: { command: "show repair 1842", customerId: "customer-001" }, headers: { "X-Shop-Role": "Administrator", "X-Customer-Id": "customer-001", Authorization: "AWS4-HMAC-SHA256 synthetic-not-a-credential" } },
  { path: "/website/mcp", method: "POST", status: 401, body: {}, headers: { Authorization: "Bearer synthetic-not-a-credential" } },
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
  const hash = createHash("sha256").update(bytes).digest("hex");
  assert.equal(response.status, test.status, `${test.path}: unexpected HTTP status`);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(response.headers.getSetCookie().length, 0);
  assert.equal(response.headers.get("location"), null);
  if (Object.hasOwn(hashes, test.path)) assert.equal(hash, hashes[test.path]);
  else {
    const result = JSON.parse(bytes.toString());
    assert.equal(result.data, undefined, "Rejected response must not return customer data");
    if (test.path === "/auth/session") assert.equal(result.code, "SIGN_IN_REQUIRED");
  }
  console.info(JSON.stringify({ path: test.path.split("?")[0], method: test.method ?? "GET", status: response.status,
    variant: test.headers ? "synthetic-header" : "ordinary", requestId: response.headers.get("apigw-requestid"), sha256: hash }));
  await delay(1100);
}
console.info("HOSTED_LWA_PRELOGIN_PASS: 16 checks. Not a real Amazon sign-in, linked-customer, or Alexa account-linking test.");
