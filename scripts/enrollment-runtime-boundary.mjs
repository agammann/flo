import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// Maximum permissions only: this is NOT an identity grant or a replacement for
// IAM Policy Autopilot. Exact resource names must come from reviewed deployment.
export function enrollmentRuntimeBoundary(kind, config) {
  assert.ok(["request", "redemption", "approval"].includes(kind), "Unknown enrollment role");
  const { account, region, tables, logGroup, redemptionVersionArn, lambdaEnvironmentKeyArn, requestDynamoKeyArn, privateDynamoKeyArn } = config;
  assert.match(account, /^\d{12}$/);
  assert.match(region, /^us-(east|west)-[12]$/);
  assert.deepEqual(Object.keys(tables).sort(), ["approvals", "audit", "auth", "links", "requests"]);
  const names = Object.values(tables);
  assert.equal(new Set(names).size, 5, "Five distinct table names required");
  for (const name of names) assert.match(name, /^[A-Za-z0-9_.-]{3,255}$/);
  assert.match(logGroup, /^\/aws\/lambda\/[A-Za-z0-9_-]{1,64}$/);
  assert.match(lambdaEnvironmentKeyArn, new RegExp(`^arn:aws:kms:${region}:${account}:key/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`),
    "An exact same-account, same-region Lambda environment key ARN is required");
  if (kind === "request") assert.match(redemptionVersionArn,
    new RegExp(`^arn:aws:lambda:${region}:${account}:function:[A-Za-z0-9_-]{1,64}:[1-9][0-9]*$`),
    "An exact same-account, same-region numeric redemption version is required");
  else assert.equal(redemptionVersionArn, undefined, "Private handlers cannot invoke functions");
  if (kind === "request") {
    assert.match(requestDynamoKeyArn, new RegExp(`^arn:aws:kms:${region}:${account}:key/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`),
      "Verified shared key for the request handler's three DynamoDB tables required");
    assert.notEqual(requestDynamoKeyArn, lambdaEnvironmentKeyArn, "Environment and DynamoDB key branches must be distinct");
  } else assert.equal(requestDynamoKeyArn, undefined, "Private handler KMS changes require separate review");
  if (kind === "request") assert.equal(privateDynamoKeyArn, undefined, "Request handler cannot use private-handler key configuration");
  if (privateDynamoKeyArn !== undefined) {
    assert.match(privateDynamoKeyArn, new RegExp(`^arn:aws:kms:${region}:${account}:key/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$`),
      "Verified shared key for all five private enrollment tables required");
    assert.notEqual(privateDynamoKeyArn, lambdaEnvironmentKeyArn, "Environment and DynamoDB key branches must be distinct");
  }
  // Opt-in review input only. Existing private deployments/templates remain
  // unchanged unless their separately reviewed update supplies this exact key.
  const dynamoKeyArn = kind === "request" ? requestDynamoKeyArn : privateDynamoKeyArn;

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
  const statements = [{ Sid: "DenyEveryOtherCapability", Effect: "Deny", NotAction: [...scopes.map(s => s.action), "kms:Decrypt"], Resource: "*" }];
  for (const { action, resources } of scopes) {
    const sid = action.replace(":", "");
    statements.push({ Sid: `Allow${sid}`, Effect: "Allow", Action: action, Resource: resources });
    // Explicit deny also protects against grants directly to a role session in a
    // resource policy, which an implicit boundary deny alone would not constrain.
    statements.push({ Sid: `DenyOther${sid}Resources`, Effect: "Deny", Action: action, NotResource: resources });
  }
  // Lambda's existing AWS-managed key policy/grant supplies the identity-side
  // authorization. This boundary only admits decryption of this function's
  // environment. Actual Encrypt/CreateGrant CloudTrail events establish this
  // exact context; startup is not assumed to populate kms:ViaService.
  const context = { "kms:CallerAccount": account,
    "kms:EncryptionContext:aws:lambda:FunctionArn": `arn:aws:lambda:${region}:${account}:function:${logGroup.slice("/aws/lambda/".length)}` };
  statements.push({ Sid: "AllowOwnEnvironmentDecrypt", Effect: "Allow", Action: "kms:Decrypt", Resource: lambdaEnvironmentKeyArn,
    Condition: { StringEquals: context } });
  statements.push({ Sid: "DenyOtherEnvironmentKeys", Effect: "Deny", Action: "kms:Decrypt",
    NotResource: dynamoKeyArn ? [lambdaEnvironmentKeyArn, dynamoKeyArn] : lambdaEnvironmentKeyArn });
  // Separate Deny statements implement OR: a wrong OR absent individual context
  // must fail closed even if a resource policy grants directly to a role session.
  for (const [key, value] of Object.entries(context)) statements.push({
    Sid: key === "kms:CallerAccount" ? "DenyWrongDecryptAccount" : "DenyWrongDecryptFunction",
    Effect: "Deny", Action: "kms:Decrypt",
    Resource: dynamoKeyArn && key !== "kms:CallerAccount" ? lambdaEnvironmentKeyArn : "*",
    Condition: { StringNotEquals: { [key]: value } }
  });
  if (dynamoKeyArn) {
    // Separate key-scoped branches prevent Lambda's function context from
    // accidentally denying DynamoDB's table context (or bypassing either one).
    // Scalar condition key with several allowed table values: ordinary string
    // matching, not ForAnyValue/ForAllValues. Missing values fail each Deny.
    const dynamoContext = {
      "kms:ViaService": `dynamodb.${region}.amazonaws.com`,
      "kms:EncryptionContext:aws:dynamodb:tableName": kind === "request" ? [tables.auth, tables.links, tables.requests] : names,
      "kms:EncryptionContext:aws:dynamodb:subscriberId": account
    };
    const label = kind === "request" ? "Request" : "Private";
    statements.push({ Sid: `Allow${label}DynamoDecrypt`, Effect: "Allow", Action: "kms:Decrypt", Resource: dynamoKeyArn,
      Condition: { StringEquals: { "kms:CallerAccount": account, ...dynamoContext } } });
    for (const [index, [key, value]] of Object.entries(dynamoContext).entries()) statements.push({
      Sid: `Deny${label}DynamoContext${index}`, Effect: "Deny", Action: "kms:Decrypt", Resource: dynamoKeyArn,
      Condition: { StringNotEquals: { [key]: value } }
    });
  }
  statements.push({ Sid: "DenyNonTransactionalWrites", Effect: "Deny", Action: ["dynamodb:PutItem", "dynamodb:UpdateItem"],
    Resource: "*", Condition: { StringNotEquals: { "dynamodb:EnclosingOperation": "TransactWriteItems" } } });
  // Optional descriptive Sids consume the managed-policy character budget.
  // For the private opt-in only, omit non-KMS Sids without changing evaluation.
  const compact = privateDynamoKeyArn ? statements.map(s => {
    if (s.Action === "kms:Decrypt") return s;
    const statement = { ...s };
    delete statement.Sid;
    return statement;
  }) : statements;
  const policy = { Version: "2012-10-17", Statement: compact };
  assert.ok(JSON.stringify(policy).length <= 6144, `Resolved ${kind} boundary exceeds IAM managed-policy size limit (${JSON.stringify(policy).length} > 6144)`);
  return policy;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [kind, filename, ...extra] = process.argv.slice(2);
  assert.equal(extra.length, 0);
  assert.ok(filename, "Usage: node scripts/enrollment-runtime-boundary.mjs request|redemption|approval reviewed-config.json");
  console.info(JSON.stringify(enrollmentRuntimeBoundary(kind, JSON.parse(await readFile(filename, "utf8"))), null, 2));
}
