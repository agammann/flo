# Controlled fictional-A activation preparation

Status: LOCAL PREPARATION TESTED. Not an executed deployment, customer link, or
completed hosted ownership test. No activation change set has been created yet.

## Source and live baseline

The live `flo-customer-enrollment` stack in account 114599789754, us-west-2 was
read back during this review: `UPDATE_COMPLETE`; request-only enrollment and
routes enabled, approval and redemption disabled. All three published handlers
remain version 3. Its original template exactly matched
`private-dynamodb-kms-update-2026-09-06.template.json`.

The next template is
`infra/aws/customer-enrollment/controlled-activation.template.json`, generated
by `scripts/build-controlled-enrollment-activation.mjs` from that baseline.
It preserves every resource, policy, artifact reference, condition and output.
Its only template-level addition is a CloudFormation rule rejecting empty or
`null` designations when approval is enabled. Runtime schema, fixed identity,
fixed customer, purpose and expiry checks remain mandatory; a nonempty string
alone is not sufficient to approve anything.

## Private designation preparation

`scripts/prepare-fictional-a-designation.py` is an offline Linux helper. It reads
one owner-only observation file, validates the complete observation schema and
lifetime, and requires the separately recorded owner's fictional-A-only consent.
It writes only a new owner-only private file and prints its path, not its contents.
It does not call AWS, grant permissions, approve requests, create invitations,
seed repairs or link customers.

The helper fixes `customerId` to `staging-customer-a`; there is no customer input.
It uses the exact observed identity fingerprint, never an email/name match or a
guessed account. A four-hour designation must be supplied privately as the
NoEcho `ApprovalDesignation` parameter. The prior expired request is evidence
only and MUST NOT be approved or redeemed. A fresh authenticated request and
explicit customer redemption are required after activation is reviewed.

The observation is NOT proof of repair ownership. The owner separately
authorized use of their own account as fictional staging customer A only. That
authorization does not cover B or real repair/customer records. The helper
cannot establish real-world ownership, and running it is not operator IAM proof.

## Planned review boundaries (not a CloudFormation change-set result)

Use a new ReleaseId and privately supplied designation; set EnableApproval and
EnableRedemption only in the separately reviewed activation change set. Preserve
all other parameters and verify pinned artifact hashes. Expected effects include:

- Publish replacement immutable versions of the three existing handlers; old
  versions have Retain / UpdateReplacePolicy Retain, not data deletion.
- Update the request handler's exact redemption-version reference and its
  permissions boundary to that same version. No additional table actions.
- Point the existing HTTP integration and route-specific Lambda permissions to
  the new request version; replacement permission resources are expected.
- Add the gated POST /enrollment/redeem route and its scoped Lambda permission.
- Enable fixed-designation private approval, but do not add an operator grant.

These are expected effects, not verified AWS change-set changes. Before execution,
inspect DescribeChangeSet and DescribeEvents, list replacements explicitly, and
obtain approval for the actual plan. Do not execute a placeholder designation.
No new tables, KMS keys, VPC, DLQ or unbounded concurrency are proposed. Existing
usage-based Lambda/API/DynamoDB/KMS/log costs continue; this is not a spending cap.

## Validation

- cfn-lint 1.52.1, us-west-2: zero errors, warnings or informational messages.
- Guard 3.2.1, pinned AWS rule revision
  `7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`: raw FAIL, not relabeled PASS.
  19 rules passed, 12 not applicable; 12 failed property checks in 3 rules.
- Remaining failures are the existing scoped treatments: three seven-day log
  groups without a customer-managed log key, three synchronous handlers without
  DLQs, and six VPC sub-property checks on those handlers. No new exception or
  security weakening is introduced by this template transform.
- The isolated Linux validator used no network or AWS credentials. Full raw
  output and exact template byte hash are in the adjacent validation JSON.
- Build and typecheck passed. An initial lint failure for structuredClone's
  missing configured global was fixed using the established JSON clone pattern;
  lint was rerun successfully.
- Application regression suite: 148 passed, 3 skipped on Windows, zero failures.
- Initial Linux Python suite: 33 passed, zero skipped/failures, including private file
  mode, symlink, hardlink, identity, consent, customer-injection and time checks.
- September 7 continuation: stored identity evidence is not artificially treated
  as an expired login token. It cannot authorize any operation itself. A new
  four-hour designation plus a new live request and session remain required.
  Added a regression test for that distinction; no deployed control was changed.
- Deployment-script tests include unchanged-resource assertions, fail-closed
  activation preconditions and checked-in generated-template parity.

Still required: the actual private designation handoff, an exact reviewed AWS
activation plan, enabled-version operator authorization, fresh request/approval/
redemption, hosted A-only and rejected B access, then replacement video and final
submission review. Website login does not establish Alexa+ account linking or
official device/Inspector/Web Simulator/certification completion.
