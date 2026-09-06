import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Project invariants only. Not cfn-lint, Guard, IAM simulation or a live change set.
const path = new URL("../infra/aws/customer-enrollment/state.template.json", import.meta.url);
const source = await readFile(path, "utf8");
const template = JSON.parse(source);
assert.equal(template.AWSTemplateFormatVersion, "2010-09-09");
assert.equal(template.Metadata.FloReview.Status, "DRAFT_NOT_APPROVED_FOR_DEPLOYMENT");
assert.deepEqual(Object.keys(template.Resources).sort(), ["EnrollmentApprovals", "EnrollmentAudit", "EnrollmentRequests"]);
for (const [name, resource] of Object.entries(template.Resources)) {
  assert.equal(resource.Type, "AWS::DynamoDB::Table");
  assert.equal(resource.DeletionPolicy, "Retain");
  assert.equal(resource.UpdateReplacePolicy, "Retain");
  const p = resource.Properties;
  assert.deepEqual(p.KeySchema, [{ AttributeName: "id", KeyType: "HASH" }]);
  assert.deepEqual(p.AttributeDefinitions, [{ AttributeName: "id", AttributeType: "S" }]);
  assert.equal(p.BillingMode, "PAY_PER_REQUEST");
  assert.equal(p.TableClass, "STANDARD");
  assert.equal(p.DeletionProtectionEnabled, true);
  assert.deepEqual(p.SSESpecification, { SSEEnabled: true });
  assert.deepEqual(p.OnDemandThroughput, { MaxReadRequestUnits: 10, MaxWriteRequestUnits: 5 });
  for (const absent of ["TableName", "ResourcePolicy", "GlobalSecondaryIndexes", "StreamSpecification", "ProvisionedThroughput", "ImportSourceSpecification"]) assert.equal(p[absent], undefined);
  if (name === "EnrollmentAudit") {
    assert.deepEqual(p.PointInTimeRecoverySpecification, { PointInTimeRecoveryEnabled: true, RecoveryPeriodInDays: 7 });
    assert.deepEqual(p.TimeToLiveSpecification, { AttributeName: "ttl", Enabled: true }); // Application enforces exact 30-day expiry; TTL is eventual cleanup.
  } else {
    assert.deepEqual(p.PointInTimeRecoverySpecification, { PointInTimeRecoveryEnabled: false });
    assert.deepEqual(p.TimeToLiveSpecification, { AttributeName: "ttl", Enabled: true });
  }
  assert.deepEqual(template.Outputs[name + "Name"].Value, { Ref: name });
  assert.deepEqual(template.Outputs[name + "Arn"].Value, { "Fn::GetAtt": [name, "Arn"] });
}
assert.equal(Object.keys(template.Outputs).length, 6);
assert.equal(template.Parameters, undefined);
console.info(JSON.stringify({ result: "ENROLLMENT_STATE_PLAN_INVARIANTS_PASS", sha256: createHash("sha256").update(source).digest("hex"), resources: 3, cloudFormationSchemaValidated: false, guardValidated: false, deployed: false }));
