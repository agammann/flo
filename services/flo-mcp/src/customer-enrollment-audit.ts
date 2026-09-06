import { z } from "zod";
import type { EnrollmentApproval } from "./customer-enrollment.js";

export const ENROLLMENT_AUDIT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const instant = z.number().int().nonnegative().max(8_000_000_000_000_000);
const auditSchema = z.object({
  id: z.string(), requestId: z.string().regex(/^[a-f0-9]{64}$/), action: z.enum(["operator_approved", "link_created"]),
  operatorId: z.string().min(1).max(128), customerId: z.string().min(1).max(128), evidenceRef: z.string().min(1).max(256),
  verificationMode: z.literal("synthetic_test_designation"), timestamp: z.iso.datetime(),
  retentionVersion: z.literal(1), expiresAt: instant, ttl: z.number().int().positive()
}).strict().refine(row => {
  const created = Date.parse(row.timestamp);
  return row.id === `${row.requestId}#${row.action}` && Number.isSafeInteger(created) && created >= 0 &&
    row.expiresAt === created + ENROLLMENT_AUDIT_RETENTION_MS && row.ttl === Math.ceil(row.expiresAt / 1000);
}, "Audit retention fields must match the original event time");
export type EnrollmentAuditRecord = z.infer<typeof auditSchema>;

export function createEnrollmentAudit(requestId: string, approval: EnrollmentApproval, action: string, now: number): EnrollmentAuditRecord {
  instant.parse(now);
  const expiresAt = now + ENROLLMENT_AUDIT_RETENTION_MS;
  return auditSchema.parse({ id: `${requestId}#${action}`, requestId, action, operatorId: approval.operatorId,
    customerId: approval.customerId, evidenceRef: approval.verification.evidenceRef, verificationMode: approval.verification.mode,
    timestamp: new Date(now).toISOString(), retentionVersion: 1, expiresAt, ttl: Math.ceil(expiresAt / 1000) });
}

/** Shared read/export/recovery boundary. Missing/legacy/malformed/expired records
 * are excluded, never assigned a fresh retention window. Does not delete data,
 * restore tables or create customer links/approval authority. No AWS calls. */
export function visibleEnrollmentAudit(rows: readonly unknown[], now = Date.now()): EnrollmentAuditRecord[] {
  instant.parse(now);
  return rows.flatMap(input => {
    const parsed = auditSchema.safeParse(input);
    if (!parsed.success || Date.parse(parsed.data.timestamp) > now || parsed.data.expiresAt <= now) return [];
    return [parsed.data];
  });
}
