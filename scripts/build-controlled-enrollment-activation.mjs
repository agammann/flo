import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

// Prepare from the verified live template, never a stale whole-stack generator.
// This does not deploy, supply a designation, or change any parameter value.
export function buildControlledEnrollmentActivation(live) {
  assert.ok(live.Parameters.PrivateDynamoKeyArn, "Private DynamoDB hardening must already be present");
  assert.equal(live.Parameters.ApprovalDesignation.NoEcho, true);
  assert.equal(live.Parameters.ApprovalDesignation.Default, "null");
  for (const name of ["Request", "Approval", "Redemption"]) {
    const version = live.Resources[`${name}Version`];
    assert.equal(version.Type, "AWS::Lambda::Version");
    assert.equal(version.DeletionPolicy, "Retain");
    assert.equal(version.UpdateReplacePolicy, "Retain");
    assert.deepEqual(version.Properties.CodeSha256, { Ref: `${name}CodeSha256` });
    assert.deepEqual(version.Properties.Description, { "Fn::Sub": `Reviewed ${name.toLowerCase()} release ${"${ReleaseId}"}` });
  }
  assert.equal(live.Resources.RedeemPairingRoute.Condition, "ExposeRedemptionRoute");
  assert.deepEqual(live.Resources.PairingIntegration.Properties.IntegrationUri, { Ref: "RequestVersion" });
  const next = JSON.parse(JSON.stringify(live));
  assert.ok(!next.Rules?.ApprovalNeedsPrivateDesignation, "Review the existing activation rule instead of overwriting it");
  next.Rules = {
    ...next.Rules,
    ApprovalNeedsPrivateDesignation: {
      RuleCondition: { "Fn::Equals": [{ Ref: "EnableApproval" }, "true"] },
      Assertions: ["null", ""].map(value => ({
        Assert: { "Fn::Not": [{ "Fn::Equals": [{ Ref: "ApprovalDesignation" }, value] }] },
        AssertDescription: "Enabling approval requires a privately supplied fixed designation; runtime also validates identity, customer, purpose and expiry.",
      })),
    },
  };
  assert.ok(Buffer.byteLength(JSON.stringify(next)) <= 51200);
  return next;
}
