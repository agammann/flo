import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildControlledEnrollmentActivation } from "./build-controlled-enrollment-activation.mjs";

const source = JSON.parse(readFileSync(new URL("../docs/verification/private-dynamodb-kms-update-2026-09-06.template.json", import.meta.url), "utf8"));

test("checked-in activation template matches the reviewed live-template transform", () => {
  const saved = JSON.parse(readFileSync(new URL("../infra/aws/customer-enrollment/controlled-activation.template.json", import.meta.url), "utf8"));
  assert.deepEqual(saved, buildControlledEnrollmentActivation(source));
});

test("activation preparation changes no resources, permissions, code or existing gates", () => {
  const before = JSON.parse(JSON.stringify(source));
  const next = buildControlledEnrollmentActivation(source);
  assert.deepEqual(source, before);
  assert.deepEqual(next.Resources, source.Resources);
  assert.deepEqual(next.Parameters, source.Parameters);
  assert.deepEqual(next.Conditions, source.Conditions);
  assert.deepEqual(next.Outputs, source.Outputs);
});

test("activation requires a non-placeholder private designation when approval is enabled", () => {
  const rule = buildControlledEnrollmentActivation(source).Rules.ApprovalNeedsPrivateDesignation;
  assert.deepEqual(rule.RuleCondition, { "Fn::Equals": [{ Ref: "EnableApproval" }, "true"] });
  assert.deepEqual(rule.Assertions.map(a => a.Assert), ["null", ""].map(value => ({
    "Fn::Not": [{ "Fn::Equals": [{ Ref: "ApprovalDesignation" }, value] }],
  })));
});

for (const [name, mutate] of [
  ["missing private KMS review", t => { delete t.Parameters.PrivateDynamoKeyArn; }],
  ["unprotected designation", t => { t.Parameters.ApprovalDesignation.NoEcho = false; }],
  ["unretained published version", t => { t.Resources.RequestVersion.UpdateReplacePolicy = "Delete"; }],
  ["unpinned code", t => { delete t.Resources.ApprovalVersion.Properties.CodeSha256; }],
  ["unconditional redemption route", t => { delete t.Resources.RedeemPairingRoute.Condition; }],
  ["unqualified request integration", t => { t.Resources.PairingIntegration.Properties.IntegrationUri = { Ref: "RequestFunction" }; }],
]) {
  test(`activation refuses ${name}`, () => {
    const changed = JSON.parse(JSON.stringify(source));
    mutate(changed);
    assert.throws(() => buildControlledEnrollmentActivation(changed));
  });
}
