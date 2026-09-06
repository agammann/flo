import assert from "node:assert/strict";
import { requestDynamoKmsCases } from "./request-dynamodb-kms-cases.mjs";

export function privateDynamoKmsCases(kind, config) {
  assert.ok(["approval", "redemption"].includes(kind));
  const rows = requestDynamoKmsCases({ ...config, requestDynamoKeyArn: config.privateDynamoKeyArn });
  const matrix = kind === "approval"
    ? { GetItem: ["requests"], ConditionCheckItem: ["auth", "links", "requests"], PutItem: ["approvals", "audit"] }
    : { GetItem: ["auth", "approvals"], ConditionCheckItem: ["auth", "approvals"], PutItem: ["links", "audit"], UpdateItem: ["requests"] };
  for (const row of rows) {
    if (["deny-database-approvals", "deny-database-audit"].includes(row.name)) {
      row.name = row.name.replace("deny-", "allow-");
      row.expected = "allowed";
    }
    if (row.action.startsWith("dynamodb:") && !row.name.startsWith("nontransactional-")) {
      const [action, name] = row.name.split("-");
      row.expected = matrix[action]?.includes(name) ? "allowed" : "explicitDeny";
    }
  }
  const positive = rows.find(r => r.name === "allow-database-auth");
  rows.push({ ...positive, name: "deny-repair-table-key-context", expected: "explicitDeny",
    context: positive.context.map(c => c.ContextKeyName.endsWith(":tableName") ? { ...c, ContextKeyValues: ["customer-repairs"] } : c) });
  rows.push({ name: "deny-repair-data", action: "dynamodb:GetItem", resource: `arn:aws:dynamodb:${config.region}:${config.account}:table/customer-repairs`, expected: "explicitDeny", context: [] });
  return rows;
}
