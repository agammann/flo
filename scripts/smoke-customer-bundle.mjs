import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

assert.equal(process.env.LWA_ENABLED, "false");
for (const key of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "LWA_CLIENT_SECRET", "FLO_CUSTOMER_STATE_KEY"]) assert.equal(process.env[key], undefined, `Do not supply ${key} to this isolated smoke test`);
const { handler } = await import(pathToFileURL(process.argv[2]).href);
const event = (path, method = "GET", extra = {}) => ({ version: "2.0", rawPath: path, rawQueryString: "", headers: {}, isBase64Encoded: false,
  requestContext: { apiId: "package-test", stage: "$default", http: { method, sourceIp: "192.0.2.8" } }, ...extra });
for (const path of ["/", "/privacy", "/terms", "/signin.js", "/signin.css"]) {
  const result = await handler(event(path));
  assert.equal(result.statusCode, 200, path);
  assert.ok(result.body.length > 0);
  assert.ok(result.headers["content-security-policy"]);
  if (path === "/privacy") {
    assert.match(result.body, /Alexander Ammann/);
    assert.match(result.body, /xyes47314@gmail.com/);
  }
  console.info(`${path}: 200`);
}
assert.equal((await handler(event("/auth/session"))).statusCode, 503);
// With no auth provider, the POST/origin boundary rejects before the 503 GET path.
assert.equal((await handler(event("/auth/lwa/start", "POST", { body: JSON.stringify({ consent: true }), headers: { origin: process.env.FLO_CUSTOMER_PUBLIC_ORIGIN, "content-type": "application/json" } }))).statusCode, 403);
assert.equal((await handler(event("/alexa/mcp"))).statusCode, 401);
assert.equal((await handler({ ...event("/"), version: "1.0" })).statusCode, 503);
console.info("BUNDLE_SMOKE_PASS: disabled login and separate Alexa route fail closed; malformed transport rejected. No provider or AWS calls.");
