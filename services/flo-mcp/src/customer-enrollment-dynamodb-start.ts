import { randomUUID } from "node:crypto";
import type { EnrollmentRequest } from "./customer-enrollment.js";
import { EnrollmentDynamoBase, requestSchema } from "./customer-enrollment-dynamodb-common.js";

/** Request writer only; deployment must independently restrict IAM. */
export class DynamoEnrollmentStarter extends EnrollmentDynamoBase {
  async start(input: EnrollmentRequest) {
    const row = requestSchema.parse(input); const now = this.now();
    if (!this.valid(row, now) || row.expiresAt > now + 300_000 || row.status !== "pending" || row.approval) return false;
    const Item = { ...row, purpose: "fictional_customer_pairing", revision: randomUUID(), ttl: Math.ceil(row.expiresAt / 1000) };
    const window = Math.floor(now / 300_000);
    return this.transact([
      this.session(row.proof, now), this.absentLink(row.identityKey),
      { Put: { TableName: this.tables.requests, Item, ConditionExpression: "attribute_not_exists(id)" } },
      { Put: { TableName: this.tables.requests, Item: { id: `identity#${row.identityKey}`, requestId: row.id, expiresAt: row.expiresAt, ttl: Item.ttl },
        ConditionExpression: "attribute_not_exists(id) OR expiresAt <= :now", ExpressionAttributeValues: { ":now": now } } },
      { Update: { TableName: this.tables.requests, Key: { id: `admission#${window}` },
        UpdateExpression: "SET #count = if_not_exists(#count, :zero) + :one, #ttl = :ttl",
        ConditionExpression: "attribute_not_exists(#count) OR #count < :limit",
        ExpressionAttributeNames: { "#count": "count", "#ttl": "ttl" }, ExpressionAttributeValues: { ":zero": 0, ":one": 1, ":limit": 500, ":ttl": (window + 2) * 300 } } }
    ]);
  }
}
