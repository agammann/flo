import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { buildEnrollmentRuntimeTemplate } from "./build-enrollment-runtime-template.mjs";

const base = new URL("../infra/aws/customer-enrollment/", import.meta.url);
const baselines = JSON.parse(await readFile(new URL("runtime-autopilot-baselines.json", base), "utf8"));
const committed = JSON.parse(await readFile(new URL("runtime.template.json", base), "utf8"));
const template = buildEnrollmentRuntimeTemplate(baselines);
test("runtime template exactly matches generator and preserves every generated baseline", () => {
  assert.deepEqual(template, committed);
  assert.ok(Buffer.byteLength(JSON.stringify(template, null, 2)) < 51200);
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
  for (const parameter of ["PublishRoutes", "EnableApproval", "EnableEnrollment"]) assert.equal(template.Parameters[parameter].Default, "false");
  assert.ok(!JSON.stringify(template).includes("TOKEN_"));
  for (const resource of Object.values(template.Resources)) {
    if (resource.Type === "AWS::IAM::ManagedPolicy") assert.ok(!resource.Properties.Users && !resource.Properties.Groups);
    if (resource.Type === "AWS::Lambda::Permission") assert.deepEqual(resource.Properties.FunctionName, { Ref: "RequestVersion" });
  }
});
test("all routes are gated, explicit, same API and pinned to the request version", () => {
  const routes = Object.values(template.Resources).filter(r => r.Type === "AWS::ApiGatewayV2::Route");
  assert.deepEqual(routes.map(r => r.Properties.RouteKey).sort(), ["GET /pairing", "GET /pairing.js", "POST /enrollment/redeem", "POST /enrollment/request"]);
  for (const route of routes) {
    assert.equal(route.Condition, "ExposeRoutes");
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
test("finite runtime limits, retained seven-day logs and immutable version checksum gates", () => {
  for (const cap of ["Request", "Redemption", "Approval"]) {
    const fn = template.Resources[`${cap}Function`].Properties;
    assert.equal(fn.ReservedConcurrentExecutions, 1);
    assert.equal(fn.MemorySize, 256);
    assert.ok(fn.Timeout <= 20);
    assert.equal(fn.LoggingConfig.ApplicationLogLevel, "WARN");
    const logs = template.Resources[`${cap}Logs`];
    assert.equal(logs.Properties.RetentionInDays, 7);
    assert.equal(logs.DeletionPolicy, "Retain");
    const version = template.Resources[`${cap}Version`];
    assert.deepEqual(version.Properties.CodeSha256, { Ref: `${cap}CodeSha256` });
    assert.ok(version.Properties.Description["Fn::Sub"].includes("${ReleaseId}"));
    assert.equal(version.DeletionPolicy, "Retain");
  }
  const approval = template.Resources.ApprovalFunction.Properties.Environment.Variables;
  assert.ok(!("FLO_CUSTOMER_STATE_KEY" in approval));
  assert.ok(!("LWA_CLIENT_ID" in approval));
  for (const cap of ["Request", "Redemption"]) assert.equal(template.Resources[`${cap}Function`].Properties.Environment.Variables.FLO_CUSTOMER_STATE_KEY["Fn::Sub"], "{{resolve:secretsmanager:${StateSecretArn}:SecretString:encryptionKey}}");
});
