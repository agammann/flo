import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { VerifiedEnrollmentIdentity } from "./durable-customer-auth.js";

export const enrollmentHash = (value: string) => createHash("sha256").update(value).digest("hex");
export const enrollmentIdentityKey = (proof: VerifiedEnrollmentIdentity) => enrollmentHash(JSON.stringify([proof.clientId, proof.amazonUserId]));
export class EnrollmentError extends Error {
  constructor(readonly status = 403) { super("Pairing is unavailable. Contact the test operator or begin a new request."); }
}
export interface EnrollmentOperator { id: string; allowedCustomerIds: readonly string[] }
export interface EnrollmentVerification { mode: "synthetic_test_designation"; evidenceRef: string }
export interface EnrollmentApproval { customerId: string; operatorId: string; verification: EnrollmentVerification; approvedAt: string; invitationHash: string }
export interface EnrollmentRequest {
  id: string; identityKey: string; proof: VerifiedEnrollmentIdentity; expiresAt: number;
  status: "pending" | "approved" | "consumed"; approval?: EnrollmentApproval;
}
/** All methods must atomically check session revision/expiry and change state.
 * redeem must consume invitation + create absent link + append audit in ONE transaction.
 * An inactive existing link is a conflict too; enrollment must never undo revocation.
 */
export interface EnrollmentTransactions {
  start(request: EnrollmentRequest): Promise<boolean>;
  approve(requestId: string, approval: EnrollmentApproval): Promise<boolean>;
  redeem(requestId: string, invitationHash: string, proof: VerifiedEnrollmentIdentity): Promise<boolean>;
}
const code = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const approveInput = z.object({ requestCode: code, customerId: z.string().min(1).max(128), verification: z.object({ mode: z.literal("synthetic_test_designation"), evidenceRef: z.string().trim().min(1).max(256) }).strict() }).strict();
export const requestInput = z.object({ consent: z.literal(true) }).strict();
export const redeemInput = z.object({ requestCode: code, invitation: code, consent: z.literal(true) }).strict();

export interface EnrollmentIdentityVerifier { enrollmentIdentity(session: string): Promise<VerifiedEnrollmentIdentity> }
export class CustomerEnrollmentRequests {
  constructor(private readonly identity: EnrollmentIdentityVerifier, private readonly transactions: Pick<EnrollmentTransactions, "start">, private readonly now: () => number = Date.now) {}
  async start(session: string, body: unknown) {
    requestInput.parse(body);
    const proof = await this.identity.enrollmentIdentity(session);
    const requestCode = randomBytes(32).toString("base64url");
    const expiresAt = Math.min(proof.expiresAt, this.now() + 300_000);
    if (expiresAt <= this.now() || !await this.transactions.start({ id: enrollmentHash(requestCode), identityKey: enrollmentIdentityKey(proof), proof, expiresAt, status: "pending" })) throw new EnrollmentError();
    return { requestCode, expiresAt, status: "awaiting_operator_verification" as const };
  }
}
export class CustomerEnrollmentRedemption {
  constructor(private readonly identity: EnrollmentIdentityVerifier, private readonly transactions: Pick<EnrollmentTransactions, "redeem">) {}
  async redeem(session: string, body: unknown) {
    const input = redeemInput.parse(body);
    const proof = await this.identity.enrollmentIdentity(session);
    if (!await this.transactions.redeem(enrollmentHash(input.requestCode), enrollmentHash(input.invitation), proof)) throw new EnrollmentError();
    return { linked: true, scope: "fictional_staging_customer" as const };
  }
}

/** Private operator service requires approval authority only, not customer login
 * credentials or the ability to start requests or create links. */
export class CustomerEnrollmentApproval {
  constructor(
    private readonly transactions: Pick<EnrollmentTransactions, "approve">,
    private readonly authorizeOperator: (credential: string) => Promise<EnrollmentOperator>,
    private readonly now: () => number = Date.now
  ) {}
  async approve(operatorCredential: string, body: unknown) {
    const input = approveInput.parse(body);
    const operator = await this.authorizeOperator(operatorCredential);
    if (!operator.id || !operator.allowedCustomerIds.includes(input.customerId)) throw new EnrollmentError();
    const invitation = randomBytes(32).toString("base64url");
    if (!await this.transactions.approve(enrollmentHash(input.requestCode), {
      customerId: input.customerId, operatorId: operator.id, verification: input.verification,
      approvedAt: new Date(this.now()).toISOString(), invitationHash: enrollmentHash(invitation)
    })) throw new EnrollmentError();
    return { invitation, status: "operator_approved" as const };
  }
}

/** Local staging increment only. Production Lambda does not construct or mount this service. */
export class CustomerEnrollment {
  constructor(
    private readonly identity: { enrollmentIdentity(session: string): Promise<VerifiedEnrollmentIdentity> },
    private readonly transactions: EnrollmentTransactions,
    private readonly authorizeOperator: (credential: string) => Promise<EnrollmentOperator>,
    private readonly now: () => number = Date.now
  ) {}
  async start(session: string, body: unknown) {
    return new CustomerEnrollmentRequests(this.identity, this.transactions, this.now).start(session, body);
  }
  /** Private operator control plane, never a customer HTTP route. Credentials come
   * from an independently authenticated operator adapter, not customer role headers.
   */
  async approve(operatorCredential: string, body: unknown) {
    return new CustomerEnrollmentApproval(this.transactions, this.authorizeOperator, this.now).approve(operatorCredential, body);
  }
  async redeem(session: string, body: unknown) {
    return new CustomerEnrollmentRedemption(this.identity, this.transactions).redeem(session, body);
  }
}
