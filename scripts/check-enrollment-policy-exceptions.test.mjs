import assert from "node:assert/strict";
import { test } from "node:test";
import { checkReview, loadReview } from "./check-enrollment-policy-exceptions.mjs";

test("approved scope covers the recorded failures without reporting Guard pass or deployment approval", async () => {
  const result = checkReview(await loadReview({ historical: true }));
  assert.equal(result.rawGuardStatus, "FAIL");
  assert.equal(result.coveredLeafFailures, 8);
  assert.equal(result.freshGuardRun, false);
  assert.equal(result.deploymentApproved, false);
});

const mutations = [
  ["template byte drift", review => { review.source += "\n"; }],
  ["encryption disabled", review => { review.source = review.source.replace('"SSEEnabled": true', '"SSEEnabled": false'); }],
  ["audit recovery disabled", review => { review.source = review.source.replace('"PointInTimeRecoveryEnabled": true', '"PointInTimeRecoveryEnabled": false'); }],
  ["audit added to PITR exception", review => { review.manifest.exceptions[1].resources.push("EnrollmentAudit"); }],
  ["uncovered exception resource", review => { review.manifest.exceptions[0].resources.pop(); }],
  ["blanket exception", review => { review.manifest.exceptions[0].resources = ["*"]; }],
  ["extra rule exception", review => { review.manifest.exceptions.push({ rule: "OTHER", resources: [], properties: [] }); }],
  ["deployment approval smuggled into manifest", review => { review.manifest.deploymentApproved = true; }],
  ["raw failure relabeled pass", review => { review.evidence.guard[0].status = "PASS"; }],
  ["new raw rule failure", review => { review.evidence.guard[0].not_compliant.push({ Rule: { name: "NEW_FAILURE", checks: [] } }); }],
  ["changed rules revision", review => { review.evidence.rulesCommit = "different"; }],
  ["missing raw leaf failure", review => { review.evidence.guard[0].not_compliant[0].Rule.checks.pop(); }]
];
for (const [name, mutate] of mutations) {
  test(`rejects ${name}`, async () => {
    const review = await loadReview({ historical: true });
    mutate(review);
    assert.throws(() => checkReview(review));
  });
}

test("old validation cannot approve the changed retention template", async () => {
  const review = await loadReview();
  assert.throws(() => checkReview(review), /Template changed/);
});
