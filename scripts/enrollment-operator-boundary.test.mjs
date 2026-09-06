import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { operatorBoundary, operatorLoginBoundary } from "./enrollment-operator-boundary.mjs";

const target = "arn:aws:lambda:us-west-2:123456789012:function:synthetic-approval:1";
const principal = "arn:aws:iam::123456789012:user/flo/synthetic-operator";

test("review artifact matches the current boundary generator and all recorded AWS cases", () => {
  const review = JSON.parse(readFileSync(new URL("../docs/verification/operator-login-boundary-review-2026-09-06.json", import.meta.url), "utf8"));
  assert.equal(review.status, "REVIEW_ONLY_NOT_ATTACHED");
  const invoke = review.boundary.Statement.find(s => s.Sid === "MaximumExactVersionWithFreshMfa");
  assert.deepEqual(review.boundary, operatorLoginBoundary(invoke.Resource, invoke.Condition.ArnEquals["aws:PrincipalArn"], invoke.Condition.DateLessThan["aws:CurrentTime"]));
  const evidence = review.simulation.return_value;
  assert.equal(evidence.simulationOnly, true);
  assert.equal(evidence.cases.length, 26);
  assert.equal(evidence.caseInputs.length, evidence.cases.length);
  assert.ok(evidence.cases.every(c => c.matches && c.decisions.length === 1 && c.decisions[0] === c.expected));
  assert.equal(review.simulation.api_calls.filter(c => c.operation === "SimulateCustomPolicy" && c.status === "success").length, 26);
});
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
test("login-compatible boundary isolates bootstrap from exact-version MFA and expiration gates", () => {
  const deadline = "2026-09-06T18:00:00.000Z";
  const policy = operatorLoginBoundary(target, principal, deadline);
  const statements = Object.fromEntries(policy.Statement.map(s => [s.Sid, s]));
  assert.equal(policy.Statement.filter(s => s.Effect === "Allow").length, 2);
  assert.deepEqual(statements.DenyOtherCapabilities.NotAction, ["lambda:InvokeFunction", "signin:AuthorizeOAuth2Access", "signin:CreateOAuth2Token"]);
  assert.equal(statements.MaximumSameAccountLocalCliLogin.Resource, "arn:aws:signin:us-west-2:123456789012:oauth2/public-client/localhost");
  assert.equal(statements.DenyOtherLoginTargets.NotResource, statements.MaximumSameAccountLocalCliLogin.Resource);
  assert.deepEqual(statements.MaximumSameAccountLocalCliLogin.Action, ["signin:AuthorizeOAuth2Access", "signin:CreateOAuth2Token"]);
  assert.equal(statements.MaximumSameAccountLocalCliLogin.Condition.ArnEquals["aws:PrincipalArn"], principal);
  assert.deepEqual(statements.DenyOtherPrincipals.Action, statements.DenyOtherCapabilities.NotAction);
  assert.equal(statements.MaximumExactVersionWithFreshMfa.Resource, target);
  assert.equal(statements.MaximumExactVersionWithFreshMfa.Condition.Bool["aws:MultiFactorAuthPresent"], "true");
  assert.equal(statements.MaximumExactVersionWithFreshMfa.Condition.NumericLessThanEquals["aws:MultiFactorAuthAge"], "900");
  assert.equal(statements.MaximumExactVersionWithFreshMfa.Condition.DateLessThan["aws:CurrentTime"], deadline);
  assert.equal(statements.DenyExpiredInvocationWindow.Condition.DateGreaterThanEquals["aws:CurrentTime"], deadline);
  assert.equal(statements.DenyMissingInvocationTime.Condition.Null["aws:CurrentTime"], "true");
  for (const sid of ["DenyMissingOrFalseMfa", "DenyMissingMfaAge", "DenyStaleMfa", "DenyInvalidMfaAge"])
    assert.equal(statements[sid].Action, "lambda:InvokeFunction", "Login bootstrap must not weaken invocation MFA");
  assert.equal(operatorBoundary(target, principal).Statement.length, 8, "Legacy builder remains unmodified");
});
test("login boundary refuses absent, invalid, noncanonical deadlines and arbitrary identities", () => {
  for (const deadline of [undefined, null, "", "tomorrow", "2026-09-06", "2026-02-30T18:00:00.000Z", "2026-09-06T18:00:00+00:00"])
    assert.throws(() => operatorLoginBoundary(target, principal, deadline));
  assert.throws(() => operatorLoginBoundary(target, "arn:aws:iam::123456789012:root", "2026-09-06T18:00:00.000Z"));
});
test("rejects unqualified names, aliases, wildcards, wrong account, role, root and malformed targets", () => {
  for (const arn of [target.slice(0, -2), target.replace(":1", ":live"), target.replace(":1", ":$LATEST"), target.replace(":1", ":0"), target.replace("synthetic-approval", "*"), "https://example.com"]) assert.throws(() => operatorBoundary(arn, principal));
  for (const arn of [principal.replace("123456789012", "999999999999"), principal.replace("user/", "role/"), "arn:aws:iam::123456789012:root", "*"]) assert.throws(() => operatorBoundary(target, arn));
});
