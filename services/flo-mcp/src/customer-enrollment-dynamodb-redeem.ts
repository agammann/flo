import { randomUUID } from "node:crypto";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { enrollmentIdentityKey } from "./customer-enrollment.js";
import type { VerifiedEnrollmentIdentity } from "./durable-customer-auth.js";
import { verifiedLinkSchema } from "./customer-dynamodb.js";
import { EnrollmentDynamoBase, hash, proofSchema, approvedRowSchema } from "./customer-enrollment-dynamodb-common.js";

/** Private redemption only; cannot create or edit operator approval snapshots. */
export class DynamoEnrollmentRedeemer extends EnrollmentDynamoBase {
  async redeem(id: string, invitationHash: string, input: VerifiedEnrollmentIdentity) {
    hash.parse(id); hash.parse(invitationHash); const proof = proofSchema.parse(input);
    const result = await this.client.send(new GetCommand({ TableName: this.tables.approvals, Key: { id }, ConsistentRead: true }));
    if (!result.Item) return false;
    const row = approvedRowSchema.parse(result.Item); const now = this.now();
    if (row.id !== id || row.ttl !== Math.ceil(row.expiresAt / 1000) || row.approval.invitationHash !== invitationHash || !this.valid(row, now)) return false;
    if (row.identityKey !== enrollmentIdentityKey(proof) || row.proof.sessionKey !== proof.sessionKey || row.proof.revision !== proof.revision || row.proof.expiresAt !== proof.expiresAt) return false;
    const approval = row.approval;
    const link = verifiedLinkSchema.parse({ id: row.identityKey, version: 1, clientId: proof.clientId, amazonUserId: proof.amazonUserId, customerId: approval.customerId, active: true, verifiedBy: approval.operatorId, verifiedAt: approval.approvedAt, evidenceRef: approval.verification.evidenceRef });
    return this.transact([
      this.session(proof, now),
      { ConditionCheck: { TableName: this.tables.approvals, Key: { id },
        ConditionExpression: "#revision = :revision AND #status = :approved AND approval = :approval AND proof = :proof AND identityKey = :identity AND expiresAt = :expires AND expiresAt > :now",
        ExpressionAttributeNames: { "#revision": "revision", "#status": "status" },
        ExpressionAttributeValues: { ":revision": row.revision, ":approved": "approved", ":approval": approval, ":proof": row.proof, ":identity": row.identityKey, ":expires": row.expiresAt, ":now": now } } },
      { Update: { TableName: this.tables.requests, Key: { id }, UpdateExpression: "SET #status = :consumed, #revision = :next",
        ConditionExpression: "#revision = :revision AND #status = :pending AND proof = :proof AND identityKey = :identity AND expiresAt = :expires AND expiresAt > :now AND attribute_not_exists(approval)",
        ExpressionAttributeNames: { "#status": "status", "#revision": "revision" }, ExpressionAttributeValues: { ":consumed": "consumed", ":next": randomUUID(), ":revision": row.revision, ":pending": "pending", ":proof": row.proof, ":identity": row.identityKey, ":expires": row.expiresAt, ":now": now } } },
      { Put: { TableName: this.tables.links, Item: link, ConditionExpression: "attribute_not_exists(id)" } },
      this.audit(row, approval, "link_created", now)
    ]);
  }
}
