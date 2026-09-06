import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// Maximum permissions only: this is NOT an identity grant or a replacement for
// IAM Policy Autopilot. Exact resource names must come from reviewed deployment.
export function enrollmentRuntimeBoundary(kind, config) {
  assert.ok(["request", "redemption", "approval"].includes(kind), "Unknown enrollment role");
  const { account, region, tables, logGroup, redemptionVersionArn } = config;
  assert.match(account, /^\d{12}$/);
  assert.match(region, /^us-(east|west)-[12]$/);
  assert.deepEqual(Object.keys(tables).sort(), ["approvals", "audit", "auth", "links", "requests"]);
  const names = Object.values(tables);
  assert.equal(new Set(names).size, 5, "Five distinct table names required");
  for (const name of names) assert.match(name, /^[A-Za-z0-9_.-]{3,255}$/);
  assert.match(logGroup, /^\/aws\/lambda\/[A-Za-z0-9_-]{1,64}$/);
  if (kind === "request") assert.match(redemptionVersionArn,
    new RegExp(`^arn:aws:lambda:${region}:${account}:function:[A-Za-z0-9_-]{1,64}:[1-9][0-9]*$`),
    "An exact same-account, same-region numeric redemption version is required");
  else assert.equal(redemptionVersionArn, undefined, "Private handlers cannot invoke functions");

  const tableArn = name => `arn:aws:dynamodb:${region}:${account}:table/${tables[name]}`;
  // Explicit capability matrix from the enrollment architecture. Condition checks
  // are distinct from reads and writes. No handler reads repair projections.
  const matrix = {
    request: { GetItem: ["auth"], ConditionCheckItem: ["auth", "links"], PutItem: ["requests"], UpdateItem: ["requests"] },
    redemption: { GetItem: ["auth", "approvals"], ConditionCheckItem: ["auth", "approvals"], PutItem: ["links", "audit"], UpdateItem: ["requests"] },
    approval: { GetItem: ["requests"], ConditionCheckItem: ["auth", "links", "requests"], PutItem: ["approvals", "audit"] }
  }[kind];
  const scopes = Object.entries(matrix).map(([action, names]) => ({ action: `dynamodb:${action}`, resources: names.map(tableArn) }));
  const logArn = `arn:aws:logs:${region}:${account}:log-group:${logGroup}:log-stream:*`;
  for (const action of ["logs:CreateLogStream", "logs:PutLogEvents"]) scopes.push({ action, resources: [logArn] });
  if (kind === "request") scopes.push({ action: "lambda:InvokeFunction", resources: [redemptionVersionArn] });
  const statements = [{ Sid: "DenyEveryOtherCapability", Effect: "Deny", NotAction: scopes.map(s => s.action), Resource: "*" }];
  for (const { action, resources } of scopes) {
    const sid = action.replace(":", "");
    statements.push({ Sid: `Allow${sid}`, Effect: "Allow", Action: action, Resource: resources });
    // Explicit deny also protects against grants directly to a role session in a
    // resource policy, which an implicit boundary deny alone would not constrain.
    statements.push({ Sid: `DenyOther${sid}Resources`, Effect: "Deny", Action: action, NotResource: resources });
  }
  statements.push({ Sid: "DenyNonTransactionalWrites", Effect: "Deny", Action: ["dynamodb:PutItem", "dynamodb:UpdateItem"],
    Resource: "*", Condition: { StringNotEquals: { "dynamodb:EnclosingOperation": "TransactWriteItems" } } });
  return { Version: "2012-10-17", Statement: statements };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [kind, filename, ...extra] = process.argv.slice(2);
  assert.equal(extra.length, 0);
  assert.ok(filename, "Usage: node scripts/enrollment-runtime-boundary.mjs request|redemption|approval reviewed-config.json");
  console.info(JSON.stringify(enrollmentRuntimeBoundary(kind, JSON.parse(await readFile(filename, "utf8"))), null, 2));
}
