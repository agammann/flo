import assert from "node:assert/strict";
import { test } from "node:test";
import { operatorBoundary } from "./enrollment-operator-boundary.mjs";

const target = "arn:aws:lambda:us-west-2:123456789012:function:synthetic-approval:1";
const principal = "arn:aws:iam::123456789012:user/flo/synthetic-operator";
test("builds a boundary, not a standalone grant; keeps exact resource and explicit deny controls", () => {
  const policy = operatorBoundary(target, principal);
  assert.equal(policy.Statement.filter(s => s.Effect === "Allow").length, 1);
  assert.equal(policy.Statement[0].Resource, target);
  assert.equal(policy.Statement[0].Condition.ArnEquals["aws:PrincipalArn"], principal);
  assert.equal(policy.Statement[0].Condition.NumericLessThanEquals["aws:MultiFactorAuthAge"], "900");
  assert.equal(policy.Statement.find(s => s.Sid === "DenyOtherFunctionsAndVersions").NotResource, target);
  assert.equal(policy.Statement.find(s => s.Sid === "DenyOtherCapabilities").NotAction, "lambda:InvokeFunction");
  assert.equal(policy.Statement.find(s => s.Sid === "DenyMissingOrFalseMfa").Condition.BoolIfExists["aws:MultiFactorAuthPresent"], "false");
  assert.equal(policy.Statement.find(s => s.Sid === "DenyMissingMfaAge").Condition.Null["aws:MultiFactorAuthAge"], "true");
});
test("rejects unqualified names, aliases, wildcards, wrong account, role, root and malformed targets", () => {
  for (const arn of [target.slice(0, -2), target.replace(":1", ":live"), target.replace(":1", ":$LATEST"), target.replace(":1", ":0"), target.replace("synthetic-approval", "*"), "https://example.com"]) assert.throws(() => operatorBoundary(arn, principal));
  for (const arn of [principal.replace("123456789012", "999999999999"), principal.replace("user/", "role/"), "arn:aws:iam::123456789012:root", "*"]) assert.throws(() => operatorBoundary(target, arn));
});
