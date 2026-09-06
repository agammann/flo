# Live fresh-MFA operator test — September 6, 2026

## Verified outcome

The intended non-root operator completed real AWS authorization and one synchronous
empty-JSON invocation of disabled approval version 2. AWS returned StatusCode 200,
ExecutedVersion 2; the application returned `{"ok":false,"status":503}`. This
establishes the credential/permission path and disabled-state refusal, not enabled
customer enrollment, repair ownership, or Alexa+ account linking.

The owner completed a new MFA sign-in. Filtered CloudTrail metadata reported a
16:57:42 UTC session creation, MFA authenticated true, and the exact operator.
No password, MFA code, authorization callback, token, or credential is in this
evidence. Actual authorization, not CloudTrail metadata alone, established success.

## Bounded checks

Exactly four DryRuns and one synchronous invocation were used; automatic retries
were disabled. All calls used the local `flo-staging-operator` profile, not the
administrative connector. DryRuns do not execute function code.

| Check | Actual result |
| --- | --- |
| Initial exact version 2 DryRun immediately after attachment | Denied: no identity-based allow |
| Exact version 2 after unchanged grant read-back | Allowed: StatusCode 204 |
| `$LATEST` DryRun | Denied: no identity-based allow |
| Unqualified function DryRun | Denied: explicit permissions-boundary deny |
| Exact version 2, synchronous `{}` | ExecutedVersion 2; disabled response `ok=false`, `status=503` |

The initial-to-later change is consistent with IAM propagation but does not prove
its cause. The `$LATEST` error does not isolate the boundary as the reason for
that denial. No policy or MFA condition was loosened between checks. There was no
old-version live check in this attempt; earlier policy simulations remain separate.

Official references: [IAM eventual consistency](https://docs.aws.amazon.com/IAM/latest/UserGuide/troubleshoot.html),
[Lambda Invoke and DryRun semantics](https://docs.aws.amazon.com/lambda/latest/api/API_Invoke.html).

## Cleanup and final state

At 17:07:05 UTC, read-back verified removal of the temporary inline invocation
grant first, followed by the boundary attachment and the temporary managed policy.
Only the original `SignInLocalDevelopmentAccess` attachment remains. There are no
inline user policies, groups, or attached boundary. The temporary policy is absent.
No other Flo resources were removed or disabled by cleanup.

At 17:08:12 UTC, `flo-customer-enrollment` remained UPDATE_COMPLETE with
EnableEnrollment, EnableApproval and PublishRoutes all false. Approval version 2
remained disabled with SHA-256 `mLliFC/rg/nKjkoD3RihLAwZjo7RWg4yGkFIQs/GDTM=`.
An initial final-state lookup used the wrong stack name; discovery corrected it.

The disabled handler returns before constructing its approval database adapter.
No request code or invitation was supplied, no customer was linked, no allowance
was replenished, and no public enrollment route was enabled. Submission and video
publication remain paused.

## Next gate

Independently designate the owner's verified Amazon test identity for fictional
customer A only, using private evidence and a finite admission deadline. Then
review a new immutable enabled version and exact invocation permissions plus a
bounded stateful test plan. Do not reuse disabled version 2 as the enabled target
or infer repair ownership from Amazon login or email matching.

See [sanitized API/CLI evidence](operator-fresh-mfa-test-2026-09-06.json).
