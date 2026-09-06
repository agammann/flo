import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

/** Review-only AWS simulator fixtures; no SDK calls, customer data or secrets. */
export function requestDynamoKmsCases(config) {
  const { account, region, tables, requestDynamoKeyArn: key, lambdaEnvironmentKeyArn: envKey, logGroup } = config;
  const context = { "kms:CallerAccount": account, "kms:ViaService": `dynamodb.${region}.amazonaws.com`,
    "kms:EncryptionContext:aws:dynamodb:subscriberId": account, "kms:EncryptionContext:aws:dynamodb:tableName": tables.auth };
  const env = { "kms:CallerAccount": account, "kms:EncryptionContext:aws:lambda:FunctionArn": `arn:aws:lambda:${region}:${account}:function:${logGroup.slice(12)}` };
  const rows = [];
  const add = (name, resource, values, expected = "explicitDeny", action = "kms:Decrypt") => rows.push({ name, action, resource, expected,
    context: Object.entries(values).filter(([, v]) => v !== undefined).map(([ContextKeyName, v]) => ({ ContextKeyName, ContextKeyType: "string", ContextKeyValues: [v] })) });
  for (const name of ["auth", "links", "requests"]) add(`allow-database-${name}`, key, { ...context, "kms:EncryptionContext:aws:dynamodb:tableName": tables[name] }, "allowed");
  add("allow-environment", envKey, env, "allowed");
  for (const name of Object.keys(context)) {
    add(`missing-${name}`, key, { ...context, [name]: undefined });
    add(`wrong-${name}`, key, { ...context, [name]: "wrong" });
  }
  for (const name of ["approvals", "audit"]) add(`deny-database-${name}`, key, { ...context, "kms:EncryptionContext:aws:dynamodb:tableName": tables[name] });
  add("deny-other-key", key.replace(/key\/.+$/, "key/ffffffff-ffff-ffff-ffff-ffffffffffff"), context);
  add("deny-other-region", key.replace(region, "us-east-1"), context);
  add("deny-other-account", key.replace(account, "999999999999"), context);
  add("deny-database-context-on-environment-key", envKey, context);
  add("deny-environment-context-on-database-key", key, env);
  for (const name of Object.keys(env)) {
    add(`missing-environment-${name}`, envKey, { ...env, [name]: undefined });
    add(`wrong-environment-${name}`, envKey, { ...env, [name]: "wrong" });
  }
  for (const action of ["kms:Encrypt", "kms:GenerateDataKey", "kms:CreateGrant", "kms:ReEncryptFrom", "kms:DescribeKey"]) add(`deny-${action}`, key, context, "explicitDeny", action);
  const matrix = { GetItem: ["auth"], ConditionCheckItem: ["auth", "links"], PutItem: ["requests"], UpdateItem: ["requests"] };
  for (const action of ["GetItem", "ConditionCheckItem", "PutItem", "UpdateItem", "DeleteItem", "Query", "Scan"]) {
    for (const name of Object.keys(tables)) add(`${action}-${name}`, `arn:aws:dynamodb:${region}:${account}:table/${tables[name]}`,
      { "dynamodb:EnclosingOperation": "TransactWriteItems" }, matrix[action]?.includes(name) ? "allowed" : "explicitDeny", `dynamodb:${action}`);
  }
  for (const action of ["PutItem", "UpdateItem"]) add(`nontransactional-${action}`, `arn:aws:dynamodb:${region}:${account}:table/${tables.requests}`, {}, "explicitDeny", `dynamodb:${action}`);
  assert.equal(new Set(rows.map(row => row.name)).size, rows.length);
  return rows;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.equal(process.argv.length, 3);
  console.info(JSON.stringify(requestDynamoKmsCases(JSON.parse(await readFile(process.argv[2], "utf8"))), null, 2));
}
