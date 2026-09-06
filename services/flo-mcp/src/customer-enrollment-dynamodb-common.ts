import { randomUUID } from "node:crypto";
import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { GetCommand, TransactWriteCommand, type DynamoDBDocumentClient, type TransactWriteCommandInput } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { enrollmentIdentityKey, type EnrollmentApproval, type EnrollmentRequest } from "./customer-enrollment.js";
import type { VerifiedEnrollmentIdentity } from "./durable-customer-auth.js";
import { createEnrollmentAudit } from "./customer-enrollment-audit.js";

export const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const proofSchema = z.object({ clientId: z.string().min(1).max(100), amazonUserId: z.string().min(1).max(256), sessionKey: z.string().min(1).max(256), revision: z.string().min(1).max(128), expiresAt: z.number().int().positive() }).strict();
export const approvalSchema = z.object({ customerId: z.string().min(1).max(128), operatorId: z.string().min(1).max(128), approvedAt: z.iso.datetime(), invitationHash: hash,
  verification: z.object({ mode: z.literal("synthetic_test_designation"), evidenceRef: z.string().min(1).max(256) }).strict() }).strict();
export const requestSchema = z.object({ id: hash, identityKey: hash, proof: proofSchema, expiresAt: z.number().int().positive(), status: z.enum(["pending", "approved", "consumed"]), approval: approvalSchema.optional() }).strict();
export const rowSchema = requestSchema.extend({ revision: z.string().uuid(), ttl: z.number().int().positive(), purpose: z.literal("fictional_customer_pairing") });
// Requests are not an authority for approval. Only the separately permissioned
// operator store can supply this immutable snapshot; redemption never updates it.
export const approvedRowSchema = rowSchema.extend({ status: z.literal("approved"), approval: approvalSchema });
type Row = z.infer<typeof rowSchema>;
type Action = NonNullable<TransactWriteCommandInput["TransactItems"]>[number];
export interface EnrollmentTables { auth: string; requests: string; approvals: string; links: string; audit: string }

/** Same-region transactions. Caller must use distinct, reviewed tables and scoped
 * credentials. Never mount on the existing customer-read Lambda without review.
 */
export class EnrollmentDynamoBase {
  constructor(protected readonly client: DynamoDBDocumentClient, protected readonly tables: EnrollmentTables, protected readonly now: () => number = Date.now) {
    const names = [tables.auth, tables.requests, tables.approvals, tables.links, tables.audit];
    if (new Set(names).size !== 5 || names.some(name => !/^[A-Za-z0-9_.-]{3,255}$/.test(name))) throw new Error("Five distinct table names required");
  }
  protected session(proof: VerifiedEnrollmentIdentity, now: number): Action {
    return { ConditionCheck: { TableName: this.tables.auth, Key: { id: proof.sessionKey },
      ConditionExpression: "#revision = :revision AND expiresAt = :expires AND expiresAt > :now",
      ExpressionAttributeNames: { "#revision": "revision" }, ExpressionAttributeValues: { ":revision": proof.revision, ":expires": proof.expiresAt, ":now": now } } };
  }
  protected absentLink(identityKey: string): Action { return { ConditionCheck: { TableName: this.tables.links, Key: { id: identityKey }, ConditionExpression: "attribute_not_exists(id)" } }; }
  protected async transact(actions: Action[]) {
    try {
      await this.client.send(new TransactWriteCommand({ TransactItems: actions, ClientRequestToken: randomUUID() }));
      return true;
    } catch (error) {
      // Business conflicts fail closed. Capacity, validation, auth and unknown
      // failures remain errors; they must never be reported as completed writes.
      if (error instanceof TransactionCanceledException && error.CancellationReasons?.some(reason => ["ConditionalCheckFailed", "TransactionConflict"].includes(reason.Code ?? "")) && error.CancellationReasons.every(reason => ["None", "ConditionalCheckFailed", "TransactionConflict"].includes(reason.Code ?? ""))) return false;
      throw error;
    }
  }
  protected valid(row: Pick<EnrollmentRequest, "identityKey" | "proof" | "expiresAt">, now: number) {
    return row.identityKey === enrollmentIdentityKey(row.proof) && row.expiresAt > now && row.expiresAt <= row.proof.expiresAt;
  }
  protected async read(id: string): Promise<Row | undefined> {
    hash.parse(id);
    const result = await this.client.send(new GetCommand({ TableName: this.tables.requests, Key: { id }, ConsistentRead: true }));
    if (!result.Item) return undefined;
    const row = rowSchema.parse(result.Item);
    if (row.id !== id || row.ttl !== Math.ceil(row.expiresAt / 1000) || !this.valid(row, this.now())) return undefined;
    return row;
  }
  protected audit(row: Row, approval: EnrollmentApproval, action: string, now: number): Action {
    return { Put: { TableName: this.tables.audit, Item: createEnrollmentAudit(row.id, approval, action, now), ConditionExpression: "attribute_not_exists(id)" } };
  }
}
