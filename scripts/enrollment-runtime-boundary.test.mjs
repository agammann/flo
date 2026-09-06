import assert from "node:assert/strict";
import { test } from "node:test";
import { enrollmentRuntimeBoundary } from "./enrollment-runtime-boundary.mjs";
import { requestDynamoKmsCases } from "./request-dynamodb-kms-cases.mjs";

const config = { account: "123456789012", region: "us-west-2", logGroup: "/aws/lambda/synthetic-request",
  lambdaEnvironmentKeyArn: "arn:aws:kms:us-west-2:123456789012:key/00000000-0000-0000-0000-000000000001",
  tables: { auth: "synthetic-auth", links: "synthetic-links", requests: "synthetic-requests", approvals: "synthetic-approvals", audit: "synthetic-audit" } };
const version = "arn:aws:lambda:us-west-2:123456789012:function:synthetic-redemption:1";
const dynamoKey = "arn:aws:kms:us-west-2:123456789012:key/00000000-0000-0000-0000-000000000003";
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
function evaluate(policy, action, resource, enclosingOperation, context = {}) {
  context = { ...context, ...(enclosingOperation === undefined ? {} : { "dynamodb:EnclosingOperation": enclosingOperation }) };
  const matches = (patterns, value) => [patterns].flat().some(pattern => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")}$`).test(value));
  const statements = policy.Statement.filter(s =>
    (s.Action ? matches(s.Action, action) : !matches(s.NotAction, action)) &&
    (s.Resource ? matches(s.Resource, resource) : !matches(s.NotResource, resource)) &&
    (!s.Condition || Object.entries(s.Condition).every(([operator, entries]) => {
      assert.ok(["StringEquals", "StringNotEquals"].includes(operator), "Unsupported test condition grammar");
      return Object.entries(entries).every(([key, value]) => operator === "StringEquals" ? [value].flat().includes(context[key]) : ![value].flat().includes(context[key]));
    })));
  return statements.some(s => s.Effect === "Deny") ? "explicitDeny" : statements.some(s => s.Effect === "Allow") ? "allowed" : "implicitDeny";
}

for (const kind of ["request", "redemption", "approval"]) {
  const policy = enrollmentRuntimeBoundary(kind, { ...config, ...(kind === "request" ? { redemptionVersionArn: version, requestDynamoKeyArn: dynamoKey } : {}) });
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
  test(`${kind}: permits only exact-key, exact-account, own-function environment decryption`, () => {
    const context = { "kms:CallerAccount": config.account,
      "kms:EncryptionContext:aws:lambda:FunctionArn": `arn:aws:lambda:${config.region}:${config.account}:function:synthetic-request` };
    const check = (action, resource, keys) => evaluate(policy, action, resource, undefined, keys);
    assert.equal(check("kms:Decrypt", config.lambdaEnvironmentKeyArn, context), "allowed");
    for (const key of Object.keys(context)) {
      assert.equal(check("kms:Decrypt", config.lambdaEnvironmentKeyArn, { ...context, [key]: "wrong" }), "explicitDeny");
      assert.equal(check("kms:Decrypt", config.lambdaEnvironmentKeyArn, { ...context, [key]: undefined }), "explicitDeny");
    }
    for (const suffix of [":1", ":live", "-other", "*"]) assert.equal(check("kms:Decrypt", config.lambdaEnvironmentKeyArn,
      { ...context, "kms:EncryptionContext:aws:lambda:FunctionArn": context["kms:EncryptionContext:aws:lambda:FunctionArn"] + suffix }), "explicitDeny");
    for (const resource of ["*", config.lambdaEnvironmentKeyArn.replace(/1$/, "2"), config.lambdaEnvironmentKeyArn.replace("123456789012", "999999999999"),
      config.lambdaEnvironmentKeyArn.replace("us-west-2", "us-east-1")]) assert.equal(check("kms:Decrypt", resource, context), "explicitDeny");
    for (const action of ["kms:Encrypt", "kms:GenerateDataKey", "kms:CreateGrant", "kms:RetireGrant", "kms:ReEncryptFrom", "kms:DescribeKey"]) {
      assert.equal(check(action, config.lambdaEnvironmentKeyArn, context), "explicitDeny");
    }
  });
}
test("request: reproduces downstream decrypt and keeps every missing/wrong constraint fail-closed", () => {
  const p = enrollmentRuntimeBoundary("request", { ...config, redemptionVersionArn: version, requestDynamoKeyArn: dynamoKey });
  const context = { "kms:CallerAccount": config.account, "kms:ViaService": "dynamodb.us-west-2.amazonaws.com",
    "kms:EncryptionContext:aws:dynamodb:subscriberId": config.account, "kms:EncryptionContext:aws:dynamodb:tableName": config.tables.auth };
  const check = (keys, resource = dynamoKey, action = "kms:Decrypt") => evaluate(p, action, resource, undefined, keys);
  for (const name of ["auth", "links", "requests"]) assert.equal(check({ ...context, "kms:EncryptionContext:aws:dynamodb:tableName": config.tables[name] }), "allowed");
  for (const key of Object.keys(context)) for (const bad of [undefined, "", "wrong", "*"]) assert.equal(check({ ...context, [key]: bad }), "explicitDeny", key);
  for (const name of ["approvals", "audit"]) assert.equal(check({ ...context, "kms:EncryptionContext:aws:dynamodb:tableName": config.tables[name] }), "explicitDeny");
  assert.equal(check({ ...context, "kms:ViaService": "dynamodb.us-east-1.amazonaws.com" }), "explicitDeny");
  assert.equal(check(context, config.lambdaEnvironmentKeyArn), "explicitDeny", "DynamoDB context cannot use environment key");
  const lambdaContext = { "kms:CallerAccount": config.account, "kms:EncryptionContext:aws:lambda:FunctionArn": "arn:aws:lambda:us-west-2:123456789012:function:synthetic-request" };
  assert.equal(check(lambdaContext), "explicitDeny", "Lambda context cannot use DynamoDB key");
  assert.equal(check({ ...lambdaContext, ...context, "kms:ViaService": undefined }), "explicitDeny", "Extra Lambda context cannot bypass service gate");
  for (const key of ["*", dynamoKey.replace(/3$/, "4"), dynamoKey.replace("us-west-2", "us-east-1"), dynamoKey.replace(config.account, "999999999999")]) assert.equal(check(context, key), "explicitDeny");
  for (const action of ["kms:Encrypt", "kms:GenerateDataKey", "kms:CreateGrant", "kms:ReEncryptFrom", "kms:DescribeKey"]) assert.equal(check(context, dynamoKey, action), "explicitDeny");
  for (const kind of ["approval", "redemption"]) assert.equal(evaluate(enrollmentRuntimeBoundary(kind, config), "kms:Decrypt", dynamoKey, undefined, context), "explicitDeny");
});
test("request: rejects unverified or ambiguous database key configuration", () => {
  for (const key of [undefined, "*", "alias/aws/dynamodb", config.lambdaEnvironmentKeyArn, dynamoKey.replace(config.account, "999999999999"), dynamoKey.replace("us-west-2", "us-east-1")]) {
    assert.throws(() => enrollmentRuntimeBoundary("request", { ...config, redemptionVersionArn: version, requestDynamoKeyArn: key }));
  }
  assert.throws(() => enrollmentRuntimeBoundary("approval", { ...config, requestDynamoKeyArn: dynamoKey }));
});
test("all AWS request fixtures match the local policy evaluator", () => {
  const input = { ...config, redemptionVersionArn: version, requestDynamoKeyArn: dynamoKey };
  const policy = enrollmentRuntimeBoundary("request", input);
  const cases = requestDynamoKmsCases(input);
  assert.equal(cases.length, 65);
  for (const row of cases) assert.equal(evaluate(policy, row.action, row.resource, undefined,
    Object.fromEntries(row.context.map(c => [c.ContextKeyName, c.ContextKeyValues[0]]))), row.expected, row.name);
});
test("rejects ambiguous or wildcard resource configuration", () => {
  for (const value of [version.slice(0, -2), version.replace(/:1$/, ":live"), version.replace(/:1$/, ":0"), version.replace("123456789012", "999999999999")]) {
    assert.throws(() => enrollmentRuntimeBoundary("request", { ...config, redemptionVersionArn: value }));
  }
  assert.throws(() => enrollmentRuntimeBoundary("approval", { ...config, redemptionVersionArn: version }));
  assert.throws(() => enrollmentRuntimeBoundary("request", { ...config, redemptionVersionArn: version, tables: { ...config.tables, links: config.tables.auth } }));
  assert.throws(() => enrollmentRuntimeBoundary("approval", { ...config, logGroup: "/aws/lambda/*" }));
  assert.throws(() => enrollmentRuntimeBoundary("unknown", config));
  for (const key of [undefined, "*", "alias/aws/lambda", config.lambdaEnvironmentKeyArn.replace("123456789012", "999999999999"),
    config.lambdaEnvironmentKeyArn.replace("us-west-2", "us-east-1")]) assert.throws(() => enrollmentRuntimeBoundary("approval", { ...config, lambdaEnvironmentKeyArn: key }));
});
