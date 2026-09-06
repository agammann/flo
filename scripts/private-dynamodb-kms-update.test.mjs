import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { buildEnrollmentRuntimeTemplate } from "./build-enrollment-runtime-template.mjs";
import { buildPrivateDynamoUpdate } from "./build-private-dynamodb-kms-update.mjs";
import { enrollmentRuntimeBoundary } from "./enrollment-runtime-boundary.mjs";

const baselines = JSON.parse(await readFile(new URL("../infra/aws/customer-enrollment/runtime-autopilot-baselines.json", import.meta.url), "utf8"));
const generated = buildEnrollmentRuntimeTemplate(baselines, { includePrivateDynamo: true });
const live = JSON.parse(await readFile(new URL("../docs/verification/request-dynamodb-kms-update-2026-09-06.template.json", import.meta.url), "utf8"));
const clone = value => JSON.parse(JSON.stringify(value));
test("private review changes only two boundary KMS branches and one parameter", () => {
  const before = clone(live);
  const next = buildPrivateDynamoUpdate(live, generated);
  assert.deepEqual(live, before, "input remains immutable");
  for (const [id, resource] of Object.entries(live.Resources)) {
    if (["ApprovalBoundary", "RedemptionBoundary"].includes(id)) {
      const nonKms = r => r.Properties.PolicyDocument.Statement.filter(s => s.Action !== "kms:Decrypt").map(s => { const copy = { ...s }; delete copy.Sid; return copy; });
      assert.deepEqual(nonKms(next.Resources[id]), nonKms(resource));
    } else assert.deepEqual(next.Resources[id], resource, id);
  }
  const restored = clone(next);
  for (const cap of ["Approval", "Redemption"]) restored.Resources[`${cap}Boundary`] = live.Resources[`${cap}Boundary`];
  delete restored.Parameters.PrivateDynamoKeyArn;
  assert.deepEqual(restored, live);
  for (const gate of ["EnableApproval", "EnableRedemption"]) assert.equal(next.Parameters[gate].Default, "false");
  assert.equal(next.Parameters.ApprovalDesignation.NoEcho, true);
  assert.throws(() => buildPrivateDynamoUpdate(next, generated));
});
test("private review refuses unexpected existing KMS permissions", () => {
  const changed = clone(live);
  changed.Resources.ApprovalBoundary.Properties.PolicyDocument.Statement.push({ Sid: "Unexpected", Effect: "Allow", Action: "kms:Decrypt", Resource: "*" });
  assert.throws(() => buildPrivateDynamoUpdate(changed, generated));
});
test("resolved private boundaries fit IAM limits with verified resource names", async () => {
  const input = JSON.parse(await readFile(new URL("../docs/verification/request-dynamodb-kms-config-2026-09-06.json", import.meta.url), "utf8"));
  const { requestDynamoKeyArn } = input;
  const base = { ...input };
  delete base.requestDynamoKeyArn;
  delete base.redemptionVersionArn;
  for (const kind of ["approval", "redemption"]) {
    const p = enrollmentRuntimeBoundary(kind, { ...base, logGroup: `/aws/lambda/flo-customer-enrollment-${kind}`, privateDynamoKeyArn: requestDynamoKeyArn });
    assert.ok(JSON.stringify(p).length <= 6144);
  }
});
