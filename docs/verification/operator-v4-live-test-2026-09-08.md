# Live version-4 operator test — September 8, 2026

## Verified result

The exact non-root `flo-staging-operator` completed local AWS CLI login. STS matched immutable user ID `AIDARVLVOAS5N5MWSFYR5`. Filtered CloudTrail metadata for the 05:54:37 UTC STS call recorded a session created at 05:53:22 UTC with MFA authenticated true. Actual Lambda authorization, not metadata alone, established the allowed path.

The reviewed temporary maximum-permissions boundary was attached and read back before the unchanged source-generated invocation baseline. Verification completed at 05:56:20 UTC. The boundary retained the exact numeric version, exact operator, MFA age 0–900 seconds and original 06:45 UTC invocation deadline.

| Actual call | Result |
| --- | --- |
| Approval version 4 DryRun | Allowed, HTTP status 204 |
| Approval version 3 DryRun | Explicit permissions-boundary deny |
| Unqualified approval DryRun | Explicit permissions-boundary deny |
| Redemption version 4 DryRun | Explicit permissions-boundary deny |
| Approval version 4 with empty JSON | StatusCode 200, ExecutedVersion 4, application `ok=false,status=400` |

Exactly four DryRuns and one synchronous empty-object call were made. Automatic retries were disabled. No request code, invitation, customer identity override or approval data was passed to Lambda. No log tail was requested. This proves the operator authorization and input-rejection path, not successful enrollment.

## Customer-side state and remaining gate

The real Login with Amazon consent flow completed and Flo displayed “You’re signed in. Shop verification is required.” Sign out remained available and repair information remained blocked.

A nonsecret browser-to-local clipboard handoff check did not match. The synthetic field was cleared; no fresh enrollment request was created. No invitation was issued, no fictional customer linked, no repair fixture seeded and no customer-B test claimed. Complete a private operator-input/output handoff before starting the five-minute request. Never put request codes, invitations, session cookies, credentials or authorization callbacks in public evidence.

## Verified cleanup

At 06:03:04 UTC the temporary inline invocation grant had been removed first, then the attached boundary and temporary managed policy. Read-back found no inline policies, groups or permissions boundary. The sole original `SignInLocalDevelopmentAccess` attachment remained. No application resources, customer records or existing audit data were removed or disabled.

Customer pairing, official Alexa+ integration verification and release checks remain incomplete. Video publication and Devpost submission remain paused. See the adjacent JSON for sanitized evidence. No source-code change or fresh full-suite/CI result is claimed by this report.
