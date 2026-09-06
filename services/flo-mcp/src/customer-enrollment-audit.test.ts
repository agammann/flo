import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEnrollmentAudit, visibleEnrollmentAudit, ENROLLMENT_AUDIT_RETENTION_MS } from "./customer-enrollment-audit.js";

const now = Date.parse("2026-09-05T12:00:00.123Z");
const approval = { customerId: "synthetic-a", operatorId: "synthetic-authority", approvedAt: new Date(now).toISOString(), invitationHash: "b".repeat(64), verification: { mode: "synthetic_test_designation" as const, evidenceRef: "fixture-only" } };
const make = () => createEnrollmentAudit("a".repeat(64), approval, "operator_approved", now);
describe("30-day fictional enrollment audit retention", () => {
  it("writes exact millisecond expiry and integer TTL seconds without bearer codes", () => {
    const row = make();
    assert.equal(row.expiresAt, now + 2_592_000_000);
    assert.equal(row.ttl, Math.ceil(row.expiresAt / 1000));
    assert.equal(row.retentionVersion, 1);
    assert.equal("invitationHash" in row, false);
    assert.equal("session" in row, false);
  });
  it("hides at the exact expiry even while an un-deleted TTL row remains", () => {
    const row = make();
    assert.equal(visibleEnrollmentAudit([row], row.expiresAt - 1).length, 1);
    assert.deepEqual(visibleEnrollmentAudit([row], row.expiresAt), []);
    assert.deepEqual(visibleEnrollmentAudit([row], row.expiresAt + 1000), []);
  });
  it("does not reset expiry on restored snapshots or mutate supplied evidence", () => {
    const snapshot = make(); const before = JSON.stringify(snapshot);
    assert.deepEqual(visibleEnrollmentAudit([snapshot], now + ENROLLMENT_AUDIT_RETENTION_MS + 1), []);
    const current = visibleEnrollmentAudit([snapshot], now + 1000)[0]!;
    assert.equal(current.expiresAt, snapshot.expiresAt); current.customerId = "edited-output";
    assert.equal(JSON.stringify(snapshot), before);
  });
  it("excludes missing, malformed, legacy, future and extended-expiry records", () => {
    const row = make(); const legacy = { ...row, ttl: undefined };
    for (const bad of [null, {}, legacy, { ...row, ttl: String(row.ttl) }, { ...row, expiresAt: row.expiresAt + 1000, ttl: row.ttl + 1 },
      { ...row, id: "wrong-id" }, { ...row, retentionVersion: 2 }, { ...row, accessToken: "never-export" }]) {
      assert.deepEqual(visibleEnrollmentAudit([bad], now), []);
    }
    assert.deepEqual(visibleEnrollmentAudit([row], now - 1), []);
    for (const time of [NaN, Infinity, -1, 1.2]) assert.throws(() => visibleEnrollmentAudit([row], time));
  });
});
