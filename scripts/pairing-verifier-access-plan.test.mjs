import test from "node:test";
import assert from "node:assert/strict";
import { verifierAccessPlan, attributes, principal, table, requestKey, kmsConstraints } from "./pairing-verifier-access-plan.mjs";
import { verifierSimulationCases } from "./pairing-verifier-simulation-cases.mjs";

const deadline = "2026-09-06T18:45:00.000Z";
const plan = verifierAccessPlan(deadline);
const byId = id => plan.boundary.Statement[plan.boundaryLabels.indexOf(id)];

test("simulation coverage has valid per-service resource types and unique scenarios", () => {
  const cases = verifierSimulationCases(deadline);
  assert.equal(cases.length, 57);
  assert.equal(new Set(cases.map(c => c.name)).size, cases.length);
  for (const c of cases) {
    if (c.resource === "*") continue;
    const expectedService = c.action.startsWith("sts:") ? "iam" : c.action.split(":")[0];
    assert.equal(c.resource.split(":")[2], expectedService);
  }
});

test("review-only generator requires a canonical deadline and has no runtime API calls", () => {
  assert.equal(plan.reviewOnly, true);
  for (const value of [undefined, "", "soon", "2026-09-06", "2026-09-06T18:45:00Z", "2026-02-30T00:00:00.000Z"]) assert.throws(() => verifierAccessPlan(value));
  assert.ok(JSON.stringify(plan.boundary).length <= 6144);
});
test("maximum data scope is exact request table and six explicit non-proof attributes", () => {
  const s = byId("MaximumProjectedPendingRequestObservation");
  assert.equal(s.Resource, table);
  assert.equal(s.Action, "dynamodb:GetItem");
  assert.deepEqual(attributes, ["id", "identityKey", "purpose", "expiresAt", "status", "ttl"]);
  assert.deepEqual(s.Condition["ForAllValues:StringEquals"]["dynamodb:Attributes"], attributes);
  assert.equal(s.Condition.Null["dynamodb:Attributes"], "false");
  assert.equal(s.Condition.Null["dynamodb:LeadingKeys"], "false");
  assert.equal(s.Condition["ForAllValues:StringLike"]["dynamodb:LeadingKeys"], "?".repeat(64));
  assert.equal(byId("DenyOtherTables").NotResource, table);
});
test("absent projection, unexpected attributes, key and selection have explicit denials", () => {
  for (const id of ["DenyUnexpectedAttributes", "DenyMissingProjection", "DenyNonSpecificSelection", "DenyOtherKeyShapes", "DenyMissingKey"]) assert.equal(byId(id).Effect, "Deny");
  assert.deepEqual(byId("DenyMissingProjection").Condition, { Null: { "dynamodb:Attributes": "true" } });
  assert.deepEqual(byId("DenyMissingKey").Condition, { Null: { "dynamodb:LeadingKeys": "true" } });
});
test("MFA and deadline are mandatory for data but not bypassed by shell bootstrap", () => {
  assert.equal(byId("DenyMissingOrFalseMfa").Condition.BoolIfExists["aws:MultiFactorAuthPresent"], "false");
  assert.equal(byId("DenyMissingMfaAge").Condition.Null["aws:MultiFactorAuthAge"], "true");
  assert.equal(byId("DenyStaleMfa").Condition.NumericGreaterThan["aws:MultiFactorAuthAge"], "900");
  assert.equal(byId("DenyNegativeMfaAge").Condition.NumericLessThan["aws:MultiFactorAuthAge"], "0");
  assert.equal(byId("DenyExpiredWindow").Condition.DateGreaterThanEquals["aws:CurrentTime"], deadline);
  for (const id of ["DenyMissingOrFalseMfa", "DenyMissingMfaAge", "DenyStaleMfa", "DenyNegativeMfaAge", "DenyExpiredWindow", "DenyMissingTime"]) assert.equal(byId(id).Effect, "Deny");
});
test("replication, unrelated KMS actions and all writes/invocations have no ceiling allowance", () => {
  const permitted = byId("DenyEveryOtherCapability").NotAction;
  for (const action of ["kms:Encrypt", "kms:CreateGrant", "kms:GenerateDataKey", "dynamodb:ReadDataForReplication", "dynamodb:Scan", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:TransactWriteItems", "lambda:InvokeFunction", "iam:PutUserPolicy", "secretsmanager:GetSecretValue", "sts:AssumeRole"]) assert.ok(!permitted.includes(action));
});
test("KMS decryption ceiling permits only the exact observed key", () => {
  const s = byId("MaximumServiceMediatedDecrypt");
  assert.equal(s.Action, "kms:Decrypt");
  assert.equal(s.Resource, requestKey);
  assert.equal(byId("DenyOtherKmsKeys").NotResource, requestKey);
});
test("each KMS service/account/context scalar has its own missing-or-wrong Deny", () => {
  assert.equal(kmsConstraints["kms:ViaService"], "dynamodb.us-west-2.amazonaws.com");
  assert.equal(kmsConstraints["kms:CallerAccount"], "114599789754");
  assert.equal(kmsConstraints["kms:EncryptionContext:aws:dynamodb:tableName"], table.split("/").at(-1));
  assert.equal(kmsConstraints["kms:EncryptionContext:aws:dynamodb:subscriberId"], "114599789754");
  for (const [key, value] of Object.entries(kmsConstraints)) {
    const s = byId(`DenyKmsConstraint:${key}`);
    assert.equal(s.Effect, "Deny");
    assert.equal(s.Action, "kms:Decrypt");
    assert.equal(s.Resource, "*");
    assert.deepEqual(s.Condition, { StringNotEquals: { [key]: value } });
  }
});
test("common explicit denials still constrain both service legs and shell operations", () => {
  for (const id of ["DenyOtherRegions", "DenyExpiredWindow", "DenyMissingTime"]) {
    const actions = byId(id).Action;
    for (const action of ["dynamodb:GetItem", "kms:Decrypt", "cloudshell:CreateEnvironment", "cloudshell:PutCredentials"]) assert.ok(actions.includes(action));
  }
  assert.deepEqual(byId("DenyOtherPrincipals").Condition, { ArnNotEquals: { "aws:PrincipalArn": principal } });
});
test("CloudShell grant is non-VPC, regional and time limited with no admin grant", () => {
  for (const s of plan.cloudShellGrant.Statement) {
    assert.equal(s.Effect, "Allow");
    assert.equal(s.Condition.ArnEquals["aws:PrincipalArn"], principal);
    assert.equal(s.Condition.StringEquals["aws:RequestedRegion"], "us-west-2");
    assert.equal(s.Condition.DateLessThan["aws:CurrentTime"], deadline);
    assert.ok(s.Action.every(action => action.startsWith("cloudshell:") && !action.includes("*")));
  }
  for (const key of ["VpcIds", "SubnetIds", "SecurityGroupIds"]) assert.equal(byId(`DenyVpc${key}`).Effect, "Deny");
});
