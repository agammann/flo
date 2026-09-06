# KMS boundary correction deployed; disabled runtime checks passed

2026-09-06. This execution record supersedes the review-only status in
[the proposal](enrollment-kms-boundary-review-2026-09-06.md).

## Execution and verification

The owner explicitly approved execution of
`flo-enrollment-kms-boundary-review-20260906` and one synthetic synchronous check
per function, bounded at 12 API attempts including connector retries.

Before execution, STS verified account `114599789754`; the us-west-2 change set
remained AVAILABLE with exactly three non-replacing Modify actions, targeting
only ApprovalBoundary, RedemptionBoundary and RequestBoundary. All enable flags
were false, and DescribeEvents returned no validation errors.

ExecuteChangeSet was called once using idempotent token
`flo-kms-boundary-approved-execute-20260906`. The stack reached UPDATE_COMPLETE.
All three live default policy versions are v2 and exactly match the reviewed,
resolved boundary documents. Existing function version-1 hashes and attached
boundaries remain correct. The API has only its original `$default` route.

## Live synthetic checks

Each invocation used RequestResponse, the exact numeric version ARN, and `{}`.
Three explicit Invoke calls completed successfully with no reported invocation
errors. No additional Invoke calls were made. The three calls were budgeted for
up to three connector retries each; the connector did not report retry counts
for successful requests, so this record does not claim transport-attempt counts.

| Published function | Lambda API status | Handler result |
| --- | --- | --- |
| flo-customer-enrollment-approval:1 | 200, no FunctionError | `{"ok":false,"status":503}` |
| flo-customer-enrollment-redemption:1 | 200, no FunctionError | `{"ok":false,"status":503}` |
| flo-customer-enrollment-request:1 | 200, no FunctionError | HTTP response 503, `Pairing is unavailable.` |

Here the application 503 is the intended disabled-gate response, not a failed
Lambda invocation. It demonstrates startup passed the previous KMS failure and
the handler ran. It does NOT demonstrate enabled enrollment, valid-customer
mapping, dependency availability or authorization after the disabled gate.

Actual function configuration confirms both enrollment gates and the approval
gate remain false. The source returns before initializing customer adapters in
this state; these checks did not read or write customer records or link identities.

## Preserved state and remaining limits

- Seven-day retention remains configured on all three new log groups.
- No log streams were returned on final inspection. WARN-only successful
  disabled responses do not establish delivery. Live logging verification and
  the earlier Logs simulator discrepancy remain unresolved.
- Customer staging and narrator remain UPDATE_COMPLETE with unchanged update
  timestamps; neither stack was modified by this operation.
- No public pairing routes, operator grants, customer mappings, Devpost
  submission or video publication were enabled.
- The 21 local boundary/template tests passed again this turn. The full build,
  regression suite, typecheck and lint passed during the immediately preceding
  proposal preparation; they were not rerun in full during this execution turn.
- Source changes and evidence remain local, not pushed. No new CI run occurred.

The next release gate is a reviewed, non-sensitive log-delivery test, then the
separately reviewed operator/enrollment and customer-ownership tests. Do not
enable routes based only on these successful disabled-path checks.

[Machine-readable evidence](enrollment-kms-deployment-2026-09-06.json) includes
API call metadata, exact policies, version hashes, payload responses and final
readbacks. No secret values or customer data are included.
