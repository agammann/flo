import assert from "node:assert/strict";
import { test } from "node:test";
import { enrollmentRuntimeBoundary } from "./enrollment-runtime-boundary.mjs";

const config = { account: "123456789012", region: "us-west-2", logGroup: "/aws/lambda/synthetic-request",
  tables: { auth: "synthetic-auth", links: "synthetic-links", requests: "synthetic-requests", approvals: "synthetic-approvals", audit: "synthetic-audit" } };
const version = "arn:aws:lambda:us-west-2:123456789012:function:synthetic-redemption:1";
export function casesForBoundary(kind, input = config) {
  const arn = name => `arn:aws:dynamodb:${input.region}:${input.account}:table/${input.tables[name]}`;
  const expected = {
    request: { GetItem: ["auth"], ConditionCheckItem: ["auth", "links"], PutItem: ["requests"], UpdateItem: ["requests"] },
    redemption: { GetItem: ["auth", "approvals"], ConditionCheckItem: ["auth", "approvals"], PutItem: ["links", "audit"], UpdateItem: ["requests"] },
    approval: { GetItem: ["requests"], ConditionCheckItem: ["auth", "links", "requests"], PutItem: ["approvals", "audit"] }
  }[kind];
  return ["GetItem", "ConditionCheckItem", "PutItem", "UpdateItem", "DeleteItem", "Query", "Scan"].flatMap(action =>
    Object.keys(input.tables).map(name => ({ action: `dynamodb:${action}`, resource: arn(name),
      expected: expected[action]?.includes(name) ? "allowed" : "explicitDeny" })));
}

// Limited evaluator for this deliberately small policy grammar, NOT an IAM
// simulator. The same matrix must also pass AWS SimulateCustomPolicy before use.
function evaluate(policy, action, resource, enclosingOperation) {
  const matches = (patterns, value) => [patterns].flat().some(pattern => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")}$`).test(value));
  const statements = policy.Statement.filter(s =>
    (s.Action ? matches(s.Action, action) : !matches(s.NotAction, action)) &&
    (s.Resource ? matches(s.Resource, resource) : !matches(s.NotResource, resource)) &&
    (!s.Condition || enclosingOperation !== s.Condition.StringNotEquals["dynamodb:EnclosingOperation"]));
  return statements.some(s => s.Effect === "Deny") ? "explicitDeny" : statements.some(s => s.Effect === "Allow") ? "allowed" : "implicitDeny";
}

for (const kind of ["request", "redemption", "approval"]) {
  const policy = enrollmentRuntimeBoundary(kind, { ...config, ...(kind === "request" ? { redemptionVersionArn: version } : {}) });
  test(`${kind}: all 35 table/action combinations match the capability matrix`, () => {
    for (const c of casesForBoundary(kind)) assert.equal(evaluate(policy, c.action, c.resource, "TransactWriteItems"), c.expected, `${c.action} ${c.resource}`);
  });
  test(`${kind}: rejects writes outside transactions including an absent condition key`, () => {
    for (const c of casesForBoundary(kind).filter(c => /PutItem|UpdateItem/.test(c.action))) {
      for (const enclosing of [undefined, "PutItem", "BatchWriteItem", "TransactGetItems", ""]) assert.equal(evaluate(policy, c.action, c.resource, enclosing), "explicitDeny");
    }
  });
  test(`${kind}: rejects repair reads, cross-account tables, secret access and privilege changes`, () => {
    for (const c of [{ action: "dynamodb:GetItem", resource: "arn:aws:dynamodb:us-west-2:123456789012:table/customer-repairs" },
      { action: "dynamodb:GetItem", resource: "arn:aws:dynamodb:us-west-2:999999999999:table/synthetic-auth" },
      { action: "iam:PutRolePolicy", resource: "*" }, { action: "secretsmanager:GetSecretValue", resource: "*" },
      { action: "kms:Decrypt", resource: "*" }]) assert.equal(evaluate(policy, c.action, c.resource), "explicitDeny");
  });
  test(`${kind}: only its log streams and exact permitted function version`, () => {
    const log = `arn:aws:logs:${config.region}:${config.account}:log-group:${config.logGroup}:log-stream:2026/09/test`;
    for (const action of ["logs:CreateLogStream", "logs:PutLogEvents"]) {
      assert.equal(evaluate(policy, action, log), "allowed");
      assert.equal(evaluate(policy, action, log.replace("synthetic-request", "other")), "explicitDeny");
    }
    assert.equal(evaluate(policy, "lambda:InvokeFunction", version), kind === "request" ? "allowed" : "explicitDeny");
    for (const target of [version.slice(0, -2), version.replace(/:1$/, ":2"), version.replace(/:1$/, ":live"), version.replace(/:1$/, ":$LATEST")]) {
      assert.equal(evaluate(policy, "lambda:InvokeFunction", target), "explicitDeny");
    }
  });
}
test("rejects ambiguous or wildcard resource configuration", () => {
  for (const value of [version.slice(0, -2), version.replace(/:1$/, ":live"), version.replace(/:1$/, ":0"), version.replace("123456789012", "999999999999")]) {
    assert.throws(() => enrollmentRuntimeBoundary("request", { ...config, redemptionVersionArn: value }));
  }
  assert.throws(() => enrollmentRuntimeBoundary("approval", { ...config, redemptionVersionArn: version }));
  assert.throws(() => enrollmentRuntimeBoundary("request", { ...config, redemptionVersionArn: version, tables: { ...config.tables, links: config.tables.auth } }));
  assert.throws(() => enrollmentRuntimeBoundary("approval", { ...config, logGroup: "/aws/lambda/*" }));
  assert.throws(() => enrollmentRuntimeBoundary("unknown", config));
});
