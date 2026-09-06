# Actual operator authorization checkpoint — 2026-09-06

Later: a [new CLI authorization and immediate repeat](operator-reauthorization-test-2026-09-06.md)
also failed closed. CloudTrail still reported the original session creation time,
so a successful new MFA session has not yet been established. Temporary grants
were again removed and verified. Do not repeat login without checking that distinction.

## Outcome

The owner approved the exact expiring boundary and invocation baseline from the
[review](operator-login-boundary-review-2026-09-06.md), at most four DryRun checks
and one empty-payload synchronous execution against disabled approval version 2,
followed by removal of the temporary permissions.

**One actual DryRun was attempted and AWS returned AccessDeniedException with
an explicit deny in the attached permissions boundary. No Lambda executed.**
The test stopped immediately, made no automatic retry, and did not attempt the
optional synchronous invocation or remaining DryRun cases. No customer data,
designation, public route, or application configuration was changed. Submission
and video publication remain paused.

## Applied and removed within this test

1. Verified current time preceded the approved 18:00 UTC deadline; the exact
   operator immutable ID and original sign-in-only policies matched the plan.
2. Verified published approval version 2 was Active, disabled and had the exact
   reviewed code checksum.
3. Created `arn:aws:iam::114599789754:policy/flo/FloOperatorDisabledV2Boundary20260906`,
   verified its document matched the reviewed boundary, attached it to the
   operator and verified attachment.
4. Only then added and read back the unchanged Autopilot-derived inline baseline
   `FloDisabledApprovalV2ControlledTest20260906`. It was never left active without
   the reviewed maximum-permission boundary.
5. Used the real local `flo-staging-operator` CLI profile, `AWS_MAX_ATTEMPTS=1`,
   `InvocationType=DryRun`, `LogType=None`, and an empty JSON payload. The returned
   denial identifies the exact intended IAM user, function version and boundary.
   The administrative connector did not perform the operator invocation.
6. Removed the inline grant, verified no inline grants remained, then removed
   the boundary attachment and deleted only this temporary managed policy.
7. At 16:46:04 UTC, read-back confirmed zero inline policies, zero groups, no
   permissions boundary, no temporary policy object, and only the original
   `SignInLocalDevelopmentAccess` attachment. No existing sign-in policy or MFA
   device was removed. The deleted policy can be recreated from the reviewed
   artifact only after renewed approval; no application resource was deleted.
8. Final cloud checks confirmed the enrollment stack was UPDATE_COMPLETE with
   all three enablement/publication gates false and approval version 2 still
   disabled with unchanged checksum.

## Meaning of the denial

CloudTrail metadata for the operator's GetCallerIdentity calls records session
creation at **16:26:31 UTC** and `mfaAuthenticated: true`. The DryRun occurred
around **16:45 UTC**, more than 15 minutes later. This is consistent with the
boundary's maximum MFA age of 900 seconds, but neither the generic denial nor
CloudTrail session attributes identifies the precise IAM condition that fired.
Do not claim that this proves aws:MultiFactorAuthAge availability or a complete
live MFA test matrix. No fresh-session successful authorization is established.

Next: obtain a separately approved fresh interactive MFA sign-in, then immediately
repeat the same scoped test after approval to reattach the temporary permissions.
Do not widen the age window, remove the missing-context deny, replace the test
operator with root, or silently extend the 18:00 UTC invocation deadline.

[Sanitized execution and cleanup evidence](operator-disabled-test-2026-09-06.json)
contains no passwords, MFA codes, access keys, raw customer identities, cookies,
invitations or cached credentials.

AWS documents that [DryRun verifies invocation permission without executing the
function](https://docs.aws.amazon.com/lambda/latest/api/API_Invoke.html).
