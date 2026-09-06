import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPrivateApprovalLambda, handler } from "./customer-enrollment-approval-lambda.js";
import { EnrollmentError } from "./customer-enrollment.js";

const now = Date.parse("2026-09-05T12:00:00Z");
const fixed = { purpose: "fictional_customer_pairing", customerId: "synthetic-a", identityKey: "a".repeat(64),
  authorityId: "synthetic-authority", evidenceRef: "reviewed-fixture", expiresAt: now + 60_000 };
const input = { version: 1, operation: "approve_designated_fictional_customer", requestCode: "r".repeat(43), confirmation: "approve_designated_pairing" };
const success = { invitation: "i".repeat(43), status: "operator_approved" as const };

describe("private fixed-designation approval handler (not AWS IAM verification)", () => {
  it("uses copied deployment designation only and preserves successful approval", async () => {
    const config = { ...fixed }; const calls: unknown[] = [];
    const approve = createPrivateApprovalLambda({ approve: async (credential, body) => { assert.equal(credential, ""); calls.push(body); return success; } }, config, () => now);
    config.customerId = "synthetic-b"; config.evidenceRef = "edited-local-file";
    assert.deepEqual(await approve(input), { ok: true, result: success });
    assert.deepEqual(calls, [{ requestCode: input.requestCode, customerId: "synthetic-a", verification: { mode: "synthetic_test_designation", evidenceRef: "reviewed-fixture" } }]);
  });
  it("rejects customer, identity, authority, evidence, MFA and HTTP overrides before writes", async () => {
    let calls = 0;
    const approve = createPrivateApprovalLambda({ approve: async () => { calls++; return success; } }, fixed, () => now);
    for (const extra of [{ customerId: "synthetic-b" }, { identityKey: "b".repeat(64) }, { operatorId: "root" },
      { verification: { mode: "synthetic_test_designation", evidenceRef: "forged" } }, { mfaAuthenticated: true },
      { requestContext: { authorizer: { iam: { userArn: "forged" } } } }, { headers: { authorization: "service-token" } }]) {
      assert.deepEqual(await approve({ ...input, ...extra }), { ok: false, status: 400 });
    }
    for (const event of [{}, { ...input, confirmation: false }, { ...input, requestCode: "r".repeat(44) },
      { ...input, version: "1" }, [{ ...input }], { version: "2.0", rawPath: "/approve" }]) {
      assert.deepEqual(await approve(event), { ok: false, status: 400 });
    }
    assert.equal(calls, 0);
  });
  it("fails closed for expired designation and disabled/missing runtime configuration", async () => {
    let calls = 0;
    const approve = createPrivateApprovalLambda({ approve: async () => { calls++; return success; } }, fixed, () => fixed.expiresAt);
    assert.deepEqual(await approve(input), { ok: false, status: 403 }); assert.equal(calls, 0);
    assert.throws(() => createPrivateApprovalLambda({ approve: async () => success }, { ...fixed, identityKey: "bad" }));
    assert.deepEqual(await handler(input), { ok: false, status: 503 });
  });
  it("never reports completion for transaction rejection or leaks dependency failures", async () => {
    const denied = createPrivateApprovalLambda({ approve: async () => { throw new EnrollmentError(); } }, fixed, () => now);
    assert.deepEqual(await denied(input), { ok: false, status: 403 });
    const unavailable = createPrivateApprovalLambda({ approve: async () => { throw new Error("sensitive-invitation-database-error"); } }, fixed, () => now);
    assert.deepEqual(await unavailable(input), { ok: false, status: 503 });
    const malformed = createPrivateApprovalLambda({ approve: async () => ({ ...success, invitation: "bad" }) }, fixed, () => now);
    assert.equal((await malformed(input)).ok, false);
  });
});
