import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { buildEnrollmentRuntimeTemplate } from "./build-enrollment-runtime-template.mjs";
import { buildRequestDynamoUpdate } from "./build-request-dynamodb-kms-update.mjs";

const base = new URL("../infra/aws/customer-enrollment/", import.meta.url);
const baselines = JSON.parse(await readFile(new URL("runtime-autopilot-baselines.json", base), "utf8"));
const committed = JSON.parse(await readFile(new URL("runtime.template.json", base), "utf8"));
const template = buildEnrollmentRuntimeTemplate(baselines);
test("review-only update preserves pinned versions, functions, routes, private boundaries and baseline grants", () => {
  const live = JSON.parse(JSON.stringify(template));
  delete live.Parameters.RequestDynamoKeyArn;
  live.Resources.RequestBoundary.Properties.PolicyDocument.Statement = live.Resources.RequestBoundary.Properties.PolicyDocument.Statement.filter(s => !s.Sid.includes("RequestDynamo"));
  live.Resources.RequestBoundary.Properties.PolicyDocument.Statement.find(s => s.Sid === "AllowlambdaInvokeFunction").Resource = ["arn:aws:lambda:us-west-2:123456789012:function:fixed-redemption:3"];
  const next = buildRequestDynamoUpdate(live, template);
  for (const key of Object.keys(live)) if (!["Resources", "Parameters"].includes(key)) assert.deepEqual(next[key], live[key]);
  for (const key of Object.keys(live.Resources)) if (key !== "RequestBoundary") assert.deepEqual(next.Resources[key], live.Resources[key]);
  for (const key of Object.keys(live.Parameters)) assert.deepEqual(next.Parameters[key], live.Parameters[key]);
  const nonKms = p => p.Resources.RequestBoundary.Properties.PolicyDocument.Statement.filter(s => s.Action !== "kms:Decrypt");
  assert.deepEqual(nonKms(next), nonKms(live));
  assert.throws(() => buildRequestDynamoUpdate(next, template));
});
test("runtime template exactly matches generator and preserves every generated baseline", () => {
  assert.deepEqual(template, committed);
  // Review files are pretty printed; submit TemplateBody as compact JSON.
  assert.ok(Buffer.byteLength(JSON.stringify(template)) < 51200);
  for (const [kind, cap] of [["request", "Request"], ["redemption", "Redemption"], ["approval", "Approval"]]) {
    assert.deepEqual(template.Resources[`${cap}Baseline`].Properties.PolicyDocument, baselines.roles[kind].generated.Policies[0].Policy);
    assert.deepEqual(template.Resources[`${cap}Role`].Properties.PermissionsBoundary, { Ref: `${cap}Boundary` });
    assert.deepEqual(template.Resources[`${cap}Function`].Properties.Role, { "Fn::GetAtt": [`${cap}Role`, "Arn"] });
  }
});
test("no new storage, user grants, secret values, public private-functions, or website replacement", () => {
  const types = Object.values(template.Resources).map(r => r.Type);
  assert.equal(types.length, 27);
  for (const type of ["AWS::DynamoDB::Table", "AWS::IAM::User", "AWS::Lambda::Url", "AWS::SecretsManager::Secret", "AWS::ApiGatewayV2::Stage", "AWS::ApiGatewayV2::Api"]) assert.ok(!types.includes(type));
  assert.equal(template.Parameters.ApprovalDesignation.Default, "null");
  assert.equal(template.Parameters.ApprovalDesignation.NoEcho, true);
  for (const parameter of ["PublishRoutes", "EnableApproval", "EnableEnrollment", "EnableRedemption"]) assert.equal(template.Parameters[parameter].Default, "false");
  assert.ok(!JSON.stringify(template).includes("TOKEN_"));
  for (const resource of Object.values(template.Resources)) {
    if (resource.Type === "AWS::IAM::ManagedPolicy") assert.ok(!resource.Properties.Users && !resource.Properties.Groups);
    if (resource.Type === "AWS::Lambda::Permission") assert.deepEqual(resource.Properties.FunctionName, { Ref: "RequestVersion" });
  }
});
test("environment decryption ceiling binds the existing key and each exact function without changing encryption configuration", () => {
  assert.equal(template.Parameters.LambdaEnvironmentKeyArn.Default, undefined);
  for (const [kind, cap] of [["request", "Request"], ["redemption", "Redemption"], ["approval", "Approval"]]) {
    const statements = template.Resources[`${cap}Boundary`].Properties.PolicyDocument.Statement;
    const allow = statements.find(s => s.Sid === "AllowOwnEnvironmentDecrypt");
    assert.equal(allow.Action, "kms:Decrypt");
    assert.deepEqual(allow.Resource, { Ref: "LambdaEnvironmentKeyArn" });
    assert.deepEqual(allow.Condition.StringEquals["kms:CallerAccount"], { Ref: "AWS::AccountId" });
    assert.deepEqual(allow.Condition.StringEquals["kms:EncryptionContext:aws:lambda:FunctionArn"], {
      "Fn::Sub": `arn:\${AWS::Partition}:lambda:\${AWS::Region}:\${AWS::AccountId}:function:\${AWS::StackName}-${kind}`
    });
    assert.ok(!("KMSKeyArn" in template.Resources[`${cap}Function`].Properties));
    assert.equal(statements.filter(s => s.Effect === "Allow" && s.Action === "kms:Decrypt").length, kind === "request" ? 2 : 1);
    for (const sid of ["DenyOtherEnvironmentKeys", "DenyWrongDecryptAccount", "DenyWrongDecryptFunction"]) assert.equal(statements.find(s => s.Sid === sid).Effect, "Deny");
  }
});
test("only request boundary adds the exact database key and three table contexts", () => {
  assert.equal(template.Parameters.RequestDynamoKeyArn.Default, undefined);
  const statements = template.Resources.RequestBoundary.Properties.PolicyDocument.Statement;
  const allow = statements.find(s => s.Sid === "AllowRequestDynamoDecrypt");
  assert.deepEqual(allow.Resource, { Ref: "RequestDynamoKeyArn" });
  assert.deepEqual(allow.Condition.StringEquals["kms:EncryptionContext:aws:dynamodb:tableName"], [{ Ref: "AuthTable" }, { Ref: "LinksTable" }, { Ref: "RequestsTable" }]);
  assert.deepEqual(statements.find(s => s.Sid === "DenyWrongDecryptFunction").Resource, { Ref: "LambdaEnvironmentKeyArn" });
  for (const cap of ["Approval", "Redemption"]) assert.ok(!JSON.stringify(template.Resources[`${cap}Boundary`]).includes("RequestDynamoKeyArn"));
});
test("all routes are gated, explicit, same API and pinned to the request version", () => {
  const routes = Object.values(template.Resources).filter(r => r.Type === "AWS::ApiGatewayV2::Route");
  assert.deepEqual(routes.map(r => r.Properties.RouteKey).sort(), ["GET /pairing", "GET /pairing.js", "POST /enrollment/redeem", "POST /enrollment/request"]);
  for (const route of routes) {
    assert.equal(route.Condition, route.Properties.RouteKey === "POST /enrollment/redeem" ? "ExposeRedemptionRoute" : "ExposeRoutes");
    assert.deepEqual(route.Properties.ApiId, { Ref: "ExistingApiId" });
  }
  assert.deepEqual(template.Resources.PairingIntegration.Properties.IntegrationUri, { Ref: "RequestVersion" });
  assert.deepEqual(template.Resources.RequestFunction.Properties.Environment.Variables.FLO_REDEMPTION_FUNCTION_ARN, { Ref: "RedemptionVersion" });
  for (const r of Object.values(template.Resources).filter(r => r.Type === "AWS::Lambda::Permission")) {
    assert.equal(r.Properties.Principal, "apigateway.amazonaws.com");
    assert.deepEqual(r.Properties.SourceAccount, { Ref: "AWS::AccountId" });
    assert.ok(!r.Properties.SourceArn["Fn::Sub"].includes("*"));
  }
});
test("request-only bootstrap cannot enable redemption or its public route; all eight flag combinations", () => {
  assert.deepEqual(template.Resources.RequestFunction.Properties.Environment.Variables.FLO_ENROLLMENT_ENABLED, { Ref: "EnableEnrollment" });
  assert.deepEqual(template.Resources.RedemptionFunction.Properties.Environment.Variables.FLO_ENROLLMENT_ENABLED, { Ref: "EnableRedemption" });
  assert.deepEqual(template.Resources.ApprovalFunction.Properties.Environment.Variables.FLO_PRIVATE_APPROVAL_ENABLED, { Ref: "EnableApproval" });
  assert.equal(template.Resources.RedeemPairingPermission.Condition, "ExposeRedemptionRoute");
  assert.equal(template.Resources.RedeemPairingRoute.Condition, "ExposeRedemptionRoute");
  const evaluate = (value, parameters) => {
    if (typeof value !== "object" || value === null) return value;
    if (value.Ref) return parameters[value.Ref];
    if (value.Condition) return evaluate(template.Conditions[value.Condition], parameters);
    if (value["Fn::And"]) return value["Fn::And"].every(item => evaluate(item, parameters));
    if (value["Fn::Equals"]) return evaluate(value["Fn::Equals"][0], parameters) === evaluate(value["Fn::Equals"][1], parameters);
    throw new Error("Unsupported test intrinsic");
  };
  for (const enabled of [false, true]) for (const publish of [false, true]) for (const redemption of [false, true]) {
    const parameters = { EnableEnrollment: String(enabled), PublishRoutes: String(publish), EnableRedemption: String(redemption) };
    assert.equal(evaluate(template.Conditions.ExposeRoutes, parameters), enabled && publish);
    assert.equal(evaluate(template.Conditions.ExposeRedemptionRoute, parameters), enabled && publish && redemption);
  }
});
test("finite runtime limits, retained seven-day logs and immutable version checksum gates", () => {
  for (const cap of ["Request", "Redemption", "Approval"]) {
    const fn = template.Resources[`${cap}Function`].Properties;
    assert.equal(fn.ReservedConcurrentExecutions, 1);
    assert.equal(fn.MemorySize, 256);
    assert.ok(fn.Timeout <= 20);
    assert.equal(fn.LoggingConfig.ApplicationLogLevel, "WARN");
    assert.equal(fn.LoggingConfig.SystemLogLevel, "INFO");
    assert.equal(fn.LoggingConfig.LogFormat, "JSON");
    const logs = template.Resources[`${cap}Logs`];
    assert.equal(logs.Properties.RetentionInDays, 7);
    assert.equal(logs.DeletionPolicy, "Retain");
    const version = template.Resources[`${cap}Version`];
    assert.deepEqual(version.Properties.CodeSha256, { Ref: `${cap}CodeSha256` });
    assert.ok(version.Properties.Description["Fn::Sub"].includes("${ReleaseId}"));
    // Changing Version.Description alone attempts publication of unchanged code/config.
    // Bind the same reviewed release marker to an actual publishable function setting.
    assert.deepEqual(fn.Description, version.Properties.Description);
    assert.equal(version.DeletionPolicy, "Retain");
  }
  const approval = template.Resources.ApprovalFunction.Properties.Environment.Variables;
  assert.ok(!("FLO_CUSTOMER_STATE_KEY" in approval));
  assert.ok(!("LWA_CLIENT_ID" in approval));
  for (const cap of ["Request", "Redemption"]) assert.equal(template.Resources[`${cap}Function`].Properties.Environment.Variables.FLO_CUSTOMER_STATE_KEY["Fn::Sub"], "{{resolve:secretsmanager:${StateSecretArn}:SecretString:encryptionKey}}");
});
