import type { CustomerLinkStore } from "@flo/agent";
import type { AtomicAuthStore, StoredAuthRecord, VerifiedEnrollmentIdentity } from "./durable-customer-auth.js";
import { enrollmentIdentityKey, type EnrollmentApproval, type EnrollmentRequest, type EnrollmentTransactions } from "./customer-enrollment.js";
import { createEnrollmentAudit, visibleEnrollmentAudit, type EnrollmentAuditRecord } from "./customer-enrollment-audit.js";

/** Explicit single-process local-test adapter. No AWS calls; not durable and never
 * used by customer-lambda.ts. Synchronous critical sections model the required
 * multi-record transaction; a hosted adapter needs real database transactions.
 */
export class LocalEnrollmentStore implements AtomicAuthStore, CustomerLinkStore, EnrollmentTransactions {
  private readonly sessions = new Map<string, StoredAuthRecord>();
  private readonly requests = new Map<string, EnrollmentRequest>();
  private readonly links = new Map<string, { customerId: string; active: boolean }>();
  private readonly audit: EnrollmentAuditRecord[] = [];
  constructor(readonly mode: "local-test-only", private readonly now: () => number = Date.now) {
    if (mode !== "local-test-only") throw new Error("Local enrollment test mode required");
  }
  async read(key: string) { return structuredClone(this.sessions.get(key)); }
  async write(key: string, expected: string | undefined, record: StoredAuthRecord) {
    if (this.sessions.get(key)?.revision !== expected) return false;
    this.sessions.set(key, structuredClone(record)); return true;
  }
  async remove(key: string) { this.sessions.delete(key); }
  private live(proof: VerifiedEnrollmentIdentity) {
    const session = this.sessions.get(proof.sessionKey);
    return !!session && session.revision === proof.revision && session.expiresAt === proof.expiresAt && session.expiresAt > this.now();
  }
  private eligible(row: EnrollmentRequest | undefined): row is EnrollmentRequest {
    return !!row && row.expiresAt > this.now() && this.live(row.proof) && !this.links.has(row.identityKey);
  }
  async start(row: EnrollmentRequest) {
    for (const [key, old] of this.requests) if (old.expiresAt <= this.now()) this.requests.delete(key);
    if (!this.eligible(row) || this.requests.has(row.id) || this.requests.size >= 500 || [...this.requests.values()].some(old => old.identityKey === row.identityKey)) return false;
    this.requests.set(row.id, structuredClone(row)); return true;
  }
  async approve(requestId: string, approval: EnrollmentApproval) {
    const row = this.requests.get(requestId);
    if (!this.eligible(row) || row.status !== "pending") return false;
    const audit = createEnrollmentAudit(requestId, approval, "operator_approved", this.now());
    row.status = "approved"; row.approval = structuredClone(approval);
    this.audit.push(audit);
    return true;
  }
  async redeem(requestId: string, invitationHash: string, proof: VerifiedEnrollmentIdentity) {
    const row = this.requests.get(requestId);
    if (!this.eligible(row) || row.status !== "approved" || !row.approval || row.approval.invitationHash !== invitationHash || !this.live(proof)) return false;
    if (row.identityKey !== enrollmentIdentityKey(proof) || row.proof.sessionKey !== proof.sessionKey || row.proof.revision !== proof.revision) return false;
    // No await between conditions and all three writes: atomic in this LOCAL adapter.
    const audit = createEnrollmentAudit(requestId, row.approval, "link_created", this.now());
    this.links.set(row.identityKey, { customerId: row.approval.customerId, active: true });
    row.status = "consumed";
    this.audit.push(audit);
    return true;
  }
  async findCustomer(clientId: string, amazonUserId: string) {
    const key = enrollmentIdentityKey({ clientId, amazonUserId, sessionKey: "", revision: "", expiresAt: 0 });
    const link = this.links.get(key); return link?.active ? link.customerId : undefined;
  }
  /** Local fixture operator only. No HTTP revocation route or production use. */
  revokeForTest(clientId: string, amazonUserId: string) {
    const key = enrollmentIdentityKey({ clientId, amazonUserId, sessionKey: "", revision: "", expiresAt: 0 });
    const link = this.links.get(key); if (link) link.active = false;
  }
  auditForTest() { return visibleEnrollmentAudit(this.audit, this.now()); }
}
