import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

// Permissions boundary only, NOT a source-derived identity-policy replacement.
// Grants nothing on its own. Do not attach until the exact deployment is reviewed.
export function operatorBoundary(functionArn, principalArn) {
  const target = /^arn:aws:lambda:(us-(?:east|west)-[12]):(\d{12}):function:([A-Za-z0-9_-]{1,64}):([1-9][0-9]*)$/.exec(functionArn);
  assert.ok(target, "Exact numeric published function version required");
  assert.ok(new RegExp(`^arn:aws:iam::${target[2]}:user/[A-Za-z0-9+=,.@_/-]+$`).test(principalArn), "Same-account IAM user required for GetSessionToken MFA path");
  const action = "lambda:InvokeFunction";
  return { Version: "2012-10-17", Statement: [
    { Sid: "MaximumExactVersionWithFreshMfa", Effect: "Allow", Action: action, Resource: functionArn,
      Condition: { ArnEquals: { "aws:PrincipalArn": principalArn }, Bool: { "aws:MultiFactorAuthPresent": "true" },
        Null: { "aws:MultiFactorAuthAge": "false" }, NumericGreaterThanEquals: { "aws:MultiFactorAuthAge": "0" }, NumericLessThanEquals: { "aws:MultiFactorAuthAge": "900" } } },
    { Sid: "DenyOtherCapabilities", Effect: "Deny", NotAction: action, Resource: "*" },
    { Sid: "DenyOtherFunctionsAndVersions", Effect: "Deny", Action: action, NotResource: functionArn },
    { Sid: "DenyOtherPrincipals", Effect: "Deny", Action: action, Resource: "*", Condition: { ArnNotEquals: { "aws:PrincipalArn": principalArn } } },
    { Sid: "DenyMissingOrFalseMfa", Effect: "Deny", Action: action, Resource: "*", Condition: { BoolIfExists: { "aws:MultiFactorAuthPresent": "false" } } },
    { Sid: "DenyMissingMfaAge", Effect: "Deny", Action: action, Resource: "*", Condition: { Null: { "aws:MultiFactorAuthAge": "true" } } },
    { Sid: "DenyStaleMfa", Effect: "Deny", Action: action, Resource: "*", Condition: { NumericGreaterThan: { "aws:MultiFactorAuthAge": "900" } } },
    { Sid: "DenyInvalidMfaAge", Effect: "Deny", Action: action, Resource: "*", Condition: { NumericLessThan: { "aws:MultiFactorAuthAge": "0" } } }
  ] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [target, principal, ...extra] = process.argv.slice(2);
  assert.equal(extra.length, 0);
  console.info(JSON.stringify(operatorBoundary(target, principal), null, 2));
}
