import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

for (const key of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "LWA_CLIENT_SECRET", "FLO_CUSTOMER_STATE_KEY"]) assert.equal(process.env[key], undefined, `Do not supply ${key} to this isolated test`);
const { handler: request } = await import(pathToFileURL(process.argv[2]).href);
const { handler: redeem } = await import(pathToFileURL(process.argv[3]).href);
process.env.FLO_ENROLLMENT_ENABLED = "false";
assert.equal((await request({})).statusCode, 503);
assert.deepEqual(await redeem({}), { ok: false, status: 503 });
Object.assign(process.env, { FLO_ENROLLMENT_ENABLED: "true", AWS_REGION: "us-west-2", FLO_AWS_ACCOUNT_ID: "123456789012", LWA_CLIENT_ID: "bundle-fixture",
  FLO_CUSTOMER_PUBLIC_ORIGIN: "https://flo.example", FLO_CUSTOMER_STATE_KEY: "ab".repeat(32), FLO_CUSTOMER_AUTH_TABLE: "synthetic-auth",
  FLO_ENROLLMENT_REQUESTS_TABLE: "synthetic-requests", FLO_ENROLLMENT_APPROVALS_TABLE: "synthetic-approvals", FLO_CUSTOMER_LINKS_TABLE: "synthetic-links",
  FLO_ENROLLMENT_AUDIT_TABLE: "synthetic-audit", FLO_CUSTOMER_API_ID: "package-test", FLO_REDEMPTION_FUNCTION_ARN: "arn:aws:lambda:us-west-2:123456789012:function:synthetic-redeemer:1" });
const event = (path, method = "GET", body) => ({ version: "2.0", rawPath: path, rawQueryString: "", headers: { origin: "https://flo.example", "content-type": "application/json" },
  isBase64Encoded: false, ...(body === undefined ? {} : { body: JSON.stringify(body) }), requestContext: { apiId: "package-test", stage: "$default", http: { method, sourceIp: "192.0.2.8" } } });
for (const path of ["/pairing", "/pairing.js"]) { const result = await request(event(path)); assert.equal(result.statusCode, 200); assert.ok(result.headers["content-security-policy"]); }
assert.equal((await request(event("/enrollment/approve", "POST", {}))).statusCode, 404);
assert.equal((await request(event("/enrollment/request", "POST", { consent: true }))).statusCode, 401);
assert.deepEqual(await redeem({}), { ok: false, status: 400 });
assert.deepEqual(await redeem({ version: 1, operation: "redeem_fictional_customer", session: "service-token", body: {} }), { ok: false, status: 400 });
console.info("ENROLLMENT_BUNDLE_SMOKE_PASS: separate artifacts load; pairing assets work; disabled, unauthenticated and invalid requests fail closed. Synthetic config only; no AWS/provider calls.");
