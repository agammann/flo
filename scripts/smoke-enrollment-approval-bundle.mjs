import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

for (const key of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "LWA_CLIENT_SECRET", "FLO_CUSTOMER_STATE_KEY", "FLO_PRIVATE_APPROVAL_DESIGNATION"]) assert.equal(process.env[key], undefined, `Do not supply ${key} to this isolated test`);
const { handler } = await import(pathToFileURL(process.argv[2]).href);
process.env.FLO_PRIVATE_APPROVAL_ENABLED = "false";
assert.deepEqual(await handler({}), { ok: false, status: 503 });
process.env.FLO_PRIVATE_APPROVAL_ENABLED = "true";
assert.deepEqual(await handler({}), { ok: false, status: 503 }, "Missing independent designation must not initialize AWS calls");
Object.assign(process.env, { AWS_REGION: "us-west-2", FLO_PRIVATE_APPROVAL_DESIGNATION: JSON.stringify({ purpose: "fictional_customer_pairing", customerId: "synthetic-a", identityKey: "a".repeat(64), authorityId: "synthetic-authority", evidenceRef: "fixture-only", expiresAt: 1 }),
  FLO_CUSTOMER_AUTH_TABLE: "synthetic-auth", FLO_ENROLLMENT_REQUESTS_TABLE: "synthetic-requests", FLO_ENROLLMENT_APPROVALS_TABLE: "synthetic-approvals", FLO_CUSTOMER_LINKS_TABLE: "synthetic-links", FLO_ENROLLMENT_AUDIT_TABLE: "synthetic-audit" });
assert.deepEqual(await handler({}), { ok: false, status: 400 });
assert.deepEqual(await handler({ version: 1, operation: "approve_designated_fictional_customer", requestCode: "r".repeat(43), confirmation: "approve_designated_pairing" }), { ok: false, status: 403 });
console.info("ENROLLMENT_APPROVAL_BUNDLE_SMOKE_PASS: disabled, unconfigured, malformed and expired designation rejected; no AWS calls or credentials.");
