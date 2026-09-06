# Request-only customer enrollment deployment

## Verified live on September 6, 2026

Following explicit approval, executed only
`flo-request-only-fixed-review-20260906T1727Z` in account 114599789754,
us-west-2. CloudFormation reached `UPDATE_COMPLETE`; the exact change set
reports `EXECUTE_COMPLETE`. The reviewed source SHA-256 is
`56c436ff30adf883708bf0192f97ebcf48db74dec5e5f82ef4e1755ee56fd2a5`.

| Published function | Version | Admission gate |
| --- | --- | --- |
| Enrollment request | 3 | Enabled |
| Enrollment redemption | 3 | Disabled |
| Private fixed-designation approval | 3 | Disabled |

All three published code hashes match the reviewed, unchanged artifacts.
The existing default API route still targets its original integration.
Only GET `/pairing`, GET `/pairing.js` and POST `/enrollment/request` were
added; all target request version 3. No redemption or approval route exists.
The request permissions boundary permits invocation of only redemption version 3
and explicitly denies other invocation resources. The operator has only the
sign-in managed policy, with no inline policy, group or permissions boundary.

Existing API throttle remains 2 requests/second, burst 5. Access logs contain
request ID, status and latency, not payloads or credentials. These controls are
not a hard spending cap. No new fixed-price resources were added in this update.

## Bounded hosted verification

Ran `scripts/verify-request-only-hosted.mjs` once, using exactly 12 HTTP requests,
no credentials/cookies, no redirects and no automatic retries. All checks passed:

- Homepage, pairing page/script, privacy and terms: 200 with expected content.
- Session read and pairing request without a session: 401.
- Pairing request without Origin: 403.
- Wrong content type: 415; invalid request schema: 400.
- Absent redemption route: 404.
- Unauthenticated `/alexa/mcp`: 401. This is not official Alexa+ validation.
- Every response had `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

No successful request, approval, invitation, customer link or repair mutation
was created by these checks. No customer session or secret was read.

## Cleanup and verifier corrections

Deleted only the explicitly approved, obsolete and unexecuted change set
`flo-request-only-review-20260906T1724Z`. AWS confirmed its absence with
`ChangeSetNotFound`. The executed corrected plan remains retrievable by its exact
ARN. The deleted review plan can be recreated from source; no deployed resource,
stack, retained Lambda version or application record was deleted.

Readback initially assumed scalar IAM Resource/NotResource values; AWS returned
one-item arrays. Normalizing the verifier established the intended exact scope;
no live policy modification was necessary. ListChangeSets omitted the executed
plan, so its retained status was checked using DescribeChangeSet directly.
An unavailable exception-class name interrupted one cleanup wrapper after the
underlying API had already confirmed absence; this was not a deployment failure.

## Remaining gate

Fresh final local checks after this deployment passed: build and no-emit
typecheck for all 13 workspace configurations; full ESLint with zero warnings;
application regressions 151 total, 148 passed, three platform-specific skips,
zero failures; and 41 runtime/operator/template/policy-exception tests passed.
No Docker launch or GitHub Actions run was repeated in this deployment increment;
earlier verified Docker evidence remains a separate checkpoint.

Request admission is deployed, not a completed customer-ownership workflow.
The next stateful test needs an agreed private request-code handoff and an
independent, fixed fictional-customer-A designation for the owner's verified
Amazon identity. Login alone must not establish ownership. No designation has
been provisioned in this increment. Approval/redemption activation, a narrowly
scoped temporary operator grant, and a controlled link/revocation procedure need
their own review. Customer B must remain inaccessible throughout.

Official Alexa+ account linking/tooling, a fresh GitHub Actions run for the final
source, replacement video review, and final submission remain separate gates.
Video publication and Devpost submission remain paused.

See [sanitized live evidence](enrollment-request-only-deployment-2026-09-06.json)
and the [pre-execution review](enrollment-request-only-changeset-2026-09-06.md).
