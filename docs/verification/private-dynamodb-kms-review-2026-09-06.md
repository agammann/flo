# Private enrollment database-key correction — ready for review

September 6, 2026. **Not executed. No customer linked.**

## Why this is separate

The request-only correction is deployed and a real signed-in request succeeded.
The two disabled private functions retain the older environment-only boundary.
Their next workflow needs the distinct DynamoDB key context; Lambda environment
decryption is not authorization for DynamoDB table-key decryption. This is a
configuration dependency review, not a claim that a hosted private approval has
already succeeded or failed.

Current DescribeTable calls verified all five enrollment tables ACTIVE with KMS
encryption ENABLED and the same existing database key. No row was read. The
proposed key ceiling is limited to those exact tables, account, subscriber ID,
regional DynamoDB service and existing key. Lambda environment decryption retains
its separate function-bound context. Wrong or missing context is explicitly denied.
The unchanged data-action matrix continues to prohibit repair reads, cross-job
access, standalone writes, arbitrary invocation and privilege changes.

Only optional non-KMS statement labels were omitted to fit the managed-policy
size limit; this has no authorization effect. Resolved approval/redemption
boundaries are 5,531 / 5,879 characters. The generator rejects oversized inputs.
Autopilot identity baselines are unchanged. See the
[complete resolved policies](private-dynamodb-kms-boundaries-REVIEW-ONLY.json).

## Verification

- Full build, typecheck and lint passed. The Windows application suite passed
  (148 passed, three platform skips); all 68 Node script regressions passed.
- 266/266 AWS SimulateCustomPolicy cases passed: each private role has 66 cases
  against its original Autopilot baseline and 67 against a broad-Allow test
  fixture. That fixture was never attached. The baseline case set excludes the
  positive environment-decrypt test because it does not model Lambda key grants.
- Access Analyzer: zero findings on either proposed boundary.
- cfn-lint: zero errors, warnings or informational findings.
- Guard raw status remains FAIL: three unchanged policy findings covering twelve
  properties (log key configuration, synchronous-function DLQ exception, VPC
  exception), 19 rules passing, 12 not applicable. These are the same previously
  approved scoped treatments, not a blanket compliance pass. No new failing
  resource category is introduced. Existing retained seven-day logs are unchanged.
- The exact template was checked in the existing isolated Docker validator with
  no network or AWS credentials, using the pinned AWS rule revision.
- The retrieved change-set template equals the reviewed artifact. Live stack
  table/key parameters match the reviewed configuration. DescribeEvents reports
  successful CREATE_CHANGESET and no VALIDATION_ERROR events.
- The current hosted request-only site again passed all 12 credential-free checks.
  This is not hosted private approval/redemption verification.

## Exact AWS plan

Stack `flo-customer-enrollment`, account `114599789754`, region `us-west-2`.

Change set `flo-private-dynamodb-kms-review-20260906`:

`arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-private-dynamodb-kms-review-20260906/09ae0d10-a82d-439a-a9ac-1d9106f00a96`

AWS reports CREATE_COMPLETE / AVAILABLE. Exactly two Modify operations:
`ApprovalBoundary` and `RedemptionBoundary`, both Replacement=False. No Add or
Remove operations. No function/version, public route, identity grant, secret,
table, key, log or concurrency changes. Approval and redemption stay false.
Only the new exact PrivateDynamoKeyArn parameter is supplied; all existing
parameters use previous values. The compact template is 34,180 bytes.

The connector identity for these administrative review calls is account root;
this is not proof of least-privilege operator authorization or fresh operator MFA.

## Execution and remaining release gates

Execution requires approval of this exact change set. It adds no billable
resources or recurring key-storage charge. Existing AWS service usage remains
billable; this is not a hard spending cap. After execution, verify exact live
boundary parity, unchanged disabled gates and published versions, and request-only
health. Do not enable private routes or issue an invitation as part of this update.

A separately verified fictional-customer designation, reviewed operator access,
hosted approval/redemption and wrong-customer/replay/logout tests remain necessary.
Do not request a fresh short-lived pairing code until that test window is ready.
The replacement video and Devpost release remain pending their actual evidence
and final publication review.

Official basis: [DynamoDB encryption usage notes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/encryption.usagenotes.html)
and [KMS ViaService conditions](https://docs.aws.amazon.com/kms/latest/developerguide/conditions-kms.html#conditions-kms-via-service).
The service authorization reference was checked for Decrypt; it maps to kms:Decrypt.

Raw evidence: [review](private-dynamodb-kms-review-2026-09-06.json),
[validation](private-dynamodb-kms-validation-2026-09-06.json),
[simulations](private-dynamodb-kms-simulations-2026-09-06.json),
[exact update](private-dynamodb-kms-update-2026-09-06.template.json).
