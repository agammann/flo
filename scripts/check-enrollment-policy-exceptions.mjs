import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const templatePath = "infra/aws/customer-enrollment/state.template.json";
const evidencePath = "docs/verification/enrollment-state-cloudshell-validation-2026-09-05.json";
const templateHash = "58881cef3da86e8dcff4119e3475a5ca9c2ee7078cba2879289118f5b0bd9cbd";
const evidenceHash = "1b013f88b8d472b3167dcc587320e9157d6dcc6cba16a20eb9b3d9f300d8ec7b";
const hash = value => createHash("sha256").update(value).digest("hex");
const scopes = [
  {
    rule: "DYNAMODB_TABLE_ENCRYPTED_KMS",
    resources: ["EnrollmentRequests", "EnrollmentApprovals", "EnrollmentAudit"],
    properties: ["SSESpecification.KMSMasterKeyId", "SSESpecification.SSEType"]
  },
  {
    rule: "DYNAMODB_PITR_ENABLED",
    resources: ["EnrollmentRequests", "EnrollmentApprovals"],
    properties: ["PointInTimeRecoverySpecification.PointInTimeRecoveryEnabled"]
  }
];

export async function loadReview({ historical = false } = {}) {
  const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
  return {
    source: await read(historical ? "docs/verification/enrollment-state-pre-retention.template.json" : templatePath),
    evidence: JSON.parse(await read(evidencePath)),
    manifest: JSON.parse(await read("infra/aws/customer-enrollment/policy-exceptions.json"))
  };
}

// A local consistency check, not an authorization mechanism or fresh Guard run.
// Changing these pins requires renewed review, not automatic exception acceptance.
export function checkReview({ source, evidence, manifest }) {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.status, "APPROVED_POLICY_TREATMENT_ONLY");
  assert.equal(manifest.deploymentApproved, false);
  assert.equal(manifest.template, templatePath);
  assert.equal(manifest.evidence, evidencePath);
  assert.equal(manifest.templateSha256, templateHash);
  assert.equal(hash(source), templateHash, "Template changed: revalidate and review exceptions");
  assert.equal(manifest.evidenceJsonSha256, evidenceHash);
  assert.equal(hash(JSON.stringify(evidence)), evidenceHash, "Evidence changed: preserve raw findings and re-review");
  assert.deepEqual(manifest.exceptions.map(({ rule, resources, properties }) => ({ rule, resources, properties })), scopes);
  assert.equal(evidence.templateSha256, templateHash);
  assert.equal(evidence.lintExit, 0);
  assert.equal(evidence.execution.exit, 19);
  assert.equal(evidence.guard.length, 1);
  const result = evidence.guard[0];
  assert.equal(result.status, "FAIL");
  const expectedChecks = scopes.flatMap(scope => scope.resources.flatMap(resource => scope.properties.map(property =>
    `${scope.rule}:/Resources/${resource}/Properties/${property.replaceAll(".", "/")}`
  ))).sort();
  const actualChecks = result.not_compliant.flatMap(({ Rule: rule }) => rule.checks.map(({ Clause: clause }) => {
    const check = (clause.Binary ?? clause.Unary).check;
    const path = check.Resolved?.from.path ?? `${check.UnResolved.value.traversed_to.path}/${check.UnResolved.value.remaining_query}`;
    return `${rule.name}:${path}`;
  })).sort();
  assert.deepEqual(actualChecks, expectedChecks, "Only the eight reviewed leaf failures are covered");
  return {
    result: "APPROVED_SCOPED_EXCEPTIONS_MATCH_RECORDED_EVIDENCE",
    templateSha256: templateHash,
    rawGuardStatus: "FAIL",
    failingRules: 2,
    coveredLeafFailures: actualChecks.length,
    freshGuardRun: false,
    deploymentApproved: false
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const historical = process.argv[2] === "--historical";
  assert.ok(process.argv.length === 2 || (process.argv.length === 3 && historical), "Only --historical is supported");
  console.info(JSON.stringify({ ...checkReview(await loadReview({ historical })), scope: historical ? "PRE_RETENTION_SNAPSHOT_ONLY_NOT_CURRENT_TEMPLATE" : "CURRENT_TEMPLATE" }));
}
