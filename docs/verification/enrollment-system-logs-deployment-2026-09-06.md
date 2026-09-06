# Enrollment system logging deployed and delivery verified

2026-09-06. This execution record supersedes the review-only status in
[the approved proposal](enrollment-system-logs-review-2026-09-06.md).

## Approved deployment

The owner approved execution of `flo-enrollment-system-logs-review-20260906`
and one synthetic disabled-state check per new function version, with a budget
of up to 12 API attempts including connector retries.

Preflight confirmed account `114599789754`, us-west-2, seven reviewed Modify
actions, no removals, no function replacements and retained old versions.
ExecuteChangeSet was called once with token
`flo-approved-system-logs-execute-20260906`. The stack reached UPDATE_COMPLETE.

All three version 2 functions use JSON logs, system INFO and application WARN.
Their code hashes match the previously approved artifacts. Version 1 is retained.
The request configuration and its permissions boundary reference exactly redemption
version 2. No log permission was broadened.

## Actual runtime and CloudWatch evidence

Three explicit synchronous Invoke calls used the published version 2 ARNs and
`{}`. All returned Lambda API status 200 without FunctionError. The request
handler returned HTTP 503, `Pairing is unavailable.`; redemption and approval
returned `{"ok":false,"status":503}`. These are the expected disabled responses,
not enabled enrollment successes. Successful connector responses do not expose
transport retry counts; this record does not claim an exact network-attempt count.

| Function version | Invocation request ID | CloudWatch result |
| --- | --- | --- |
| request:2 | d735103d-fa2f-4246-a81a-957db3f0b3e1 | Matching version 2 start and successful report |
| redemption:2 | 2a2910c0-a067-4cdf-ad11-bd7654956a2a | Matching version 2 start and successful report |
| approval:2 | d292bb41-9bda-41c7-9046-bbc98ae57dbf | Matching version 2 start and successful report |

Invocation window: 15:34:00–15:34:03 UTC. DescribeLogStreams found each new
version 2 stream. GetLogEvents at 15:37:39 UTC returned three platform events
per function: initStart, start and report. Every start/report request ID matched
the invocation, and each report status was success. The nine observed records
contained platform metadata, not customer payloads or credentials.

This is actual CloudWatch delivery evidence, independent of invocation Tail.
No manual stream creation or injected log events were used. The earlier IAM
Logs simulator discrepancy remains unexplained; it is not a live delivery
failure for these tested functions and exact own-group permissions.

## Final preservation check

At 15:38:19 UTC:
- Enrollment stack UPDATE_COMPLETE; EnableEnrollment, EnableApproval and
  PublishRoutes all false.
- All three log groups retain logs for seven days.
- The existing customer API still has only route `$default`, ID `9v2n2sm`,
  target `integrations/qfwnq4s`; no public pairing route was added.
- Customer staging remains UPDATE_COMPLETE, last updated
  2026-09-06T03:00:49.569000+00:00.
- Narrator remains UPDATE_COMPLETE, last updated
  2026-09-05T23:27:43.824000+00:00.
- No customer record access, identity mapping, operator grant, Devpost submission
  or video publication occurred.

The 21 boundary/template tests passed again in this execution turn. The full
regression suite, build, typecheck and lint passed during proposal preparation,
not rerun in full during execution. Source/evidence changes remain local; there
was no push or fresh GitHub Actions run.

Seven-day retention limits lifetime, not spend. INFO logs add usage-dependent
ingestion/storage. This update adds no VPC, NAT gateway, DLQ, customer-managed
key or provisioned concurrency, and makes no zero-cost or hard-cap claim.

## Remaining release gate

Runtime startup and operational log delivery are now verified. Enabled operator
approval, enrollment/redemption and customer-ownership rejection tests still need
their separately reviewed access and test scope. Keep public pairing disabled
until those checks pass. Website sign-in is not proof of repair ownership or
official Alexa+ account linking.

[Machine-readable evidence](enrollment-system-logs-deployment-2026-09-06.json)
contains sanitized responses, live settings, API call metadata and the observed
CloudWatch platform events.
