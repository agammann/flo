import type { EnrollmentApproval } from "./customer-enrollment.js";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { EnrollmentDynamoBase, approvalSchema, hash, type EnrollmentTables } from "./customer-enrollment-dynamodb-common.js";

/** Operator-only snapshot writer. No link creation or request mutation. */
export class DynamoEnrollmentApprover extends EnrollmentDynamoBase {
  protected acceptsIdentity(_identityKey: string) { return true; }
  async approve(id: string, input: EnrollmentApproval) {
    const approval = approvalSchema.parse(input); const row = await this.read(id); const now = this.now();
    if (!row || row.status !== "pending" || row.approval || !this.valid(row, now) || !this.acceptsIdentity(row.identityKey)) return false;
    return this.transact([
      this.session(row.proof, now), this.absentLink(row.identityKey),
      { ConditionCheck: { TableName: this.tables.requests, Key: { id },
        ConditionExpression: "#revision = :revision AND #status = :pending AND proof = :proof AND identityKey = :identity AND expiresAt = :expires AND expiresAt > :now AND attribute_not_exists(approval)",
        ExpressionAttributeNames: { "#status": "status", "#revision": "revision" },
        ExpressionAttributeValues: { ":revision": row.revision, ":pending": "pending", ":proof": row.proof, ":identity": row.identityKey, ":expires": row.expiresAt, ":now": now } } },
      { Put: { TableName: this.tables.approvals, Item: { ...row, status: "approved", approval }, ConditionExpression: "attribute_not_exists(id)" } },
      this.audit(row, approval, "operator_approved", now)
    ]);
  }
}

/** Deployment-controlled designation, never an event or local operator grant.
 * The existing transaction also compares this exact identity and proof at commit. */
export class DynamoDesignatedEnrollmentApprover extends DynamoEnrollmentApprover {
  private readonly identityKey: string;
  constructor(client: DynamoDBDocumentClient, tables: EnrollmentTables, identityKey: string, now: () => number = Date.now) {
    super(client, tables, now);
    this.identityKey = hash.parse(identityKey);
  }
  protected override acceptsIdentity(identityKey: string) { return identityKey === this.identityKey; }
}
