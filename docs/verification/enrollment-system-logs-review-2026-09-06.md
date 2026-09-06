# Enrollment system-log verification plan — review only

2026-09-06. **Not executed. No live function invocation this turn.**

## Read-only finding and minimal proposal

The three exact enrollment log groups still have no streams after the successful
disabled-state checks. Seven-day retention is present. Lambda's current JSON
system logging is WARN, which filters normal start/report events. The handlers'
disabled branches emit no application logs. This explains why the tests were
not suitable for proving delivery; it does not rule out a permissions problem.

Set only `LoggingConfig.SystemLogLevel` to INFO for the three enrollment
functions. Keep JSON format, ApplicationLogLevel WARN, seven-day retention,
concurrency one, unchanged code and the existing IAM/KMS safeguards. Platform
records contain operational identifiers, duration and memory metrics; the change
does not add application payload, cookie, credential or customer logging.

Lambda logging configuration qualifies for version publication. A new reviewed
ReleaseId is needed to publish immutable snapshots; reusing version 1 would not
test the new configuration. Published version numbers must be discovered from
the completed stack, not guessed.

References: [Lambda log filtering and system event mapping](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatchlogs-log-level.html),
[versioned configuration](https://docs.aws.amazon.com/lambda/latest/dg/configuration-versions.html),
[CloudFormation version replacement](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-lambda-version.html).

## Verification before review

- Full regression suite and build: passed.
- Typecheck and lint: passed.
- Boundary/template tests: 21 passed, zero failed, including INFO system level,
  WARN application level, retained logs, disabled defaults and exact KMS scopes.
- Existing isolated Docker validator, no network or AWS credentials:
  cfn-lint reports zero errors/warnings/info; Guard reports the same three
  previously accepted policies (explicit log CMKs, DLQ, VPC), with 19 passing
  and 12 skipped policies. No findings were suppressed.
- Live-template comparison: only the three function LoggingConfig values differ
  in template content. Runtime code, artifact versions, all other configuration
  and boundary templates match the deployed source. ReleaseId changes separately
  as an update parameter to publish the new snapshots.

## Exact AWS change set

Account `114599789754`, us-west-2, stack `flo-customer-enrollment`.

Name: `flo-enrollment-system-logs-review-20260906`.

ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-enrollment-system-logs-review-20260906/838d3f90-6dff-4db7-9485-32a79518b5c8`.

Status CREATE_COMPLETE, execution AVAILABLE. DescribeEvents reports no
validation errors. Proposed ReleaseId: `logging-review-20260906-8613959`.

| Resource | Reviewed action |
| --- | --- |
| ApprovalFunction, RedemptionFunction | In-place LoggingConfig update |
| RequestFunction | In-place LoggingConfig update and exact new redemption-version environment reference |
| ApprovalVersion, RedemptionVersion, RequestVersion | ReplaceAndRetain: publish new immutable versions; retain all old versions |
| RequestBoundary | In-place update to permit only the exact new redemption version |

Seven resource changes, no Remove actions. Function resources are not replaced.
There is no new public route, operator grant, table, secret or key. All three
enable flags remain false. Request version 1 would retain its old redemption
reference while its shared boundary moves to the new version; it remains
disabled and is not an enabled fallback without a reviewed rollback.

## Cost and post-approval test

INFO system logs add CloudWatch ingestion/storage volume per invocation; seven-day
retention bounds log lifetime, not dollars. New versions occupy Lambda code
storage capacity. Existing function, storage, logging and other workload usage
continues. This plan adds no provisioned concurrency, VPC, NAT gateway, queue or
customer-managed key. It is not a hard spending cap or a zero-cost guarantee.

After separate explicit execution approval, verify the stack, hashes, exact
version references, KMS/log scopes and disabled gates. Invoke each new numeric
version synchronously once with `{}`, stopping on unexpected results. Budget
at most 12 API attempts including connector retries. Read the exact three
CloudWatch groups for resulting platform records; a Tail response alone is not
CloudWatch delivery proof. Report success only if records are actually observed.
If no records arrive, retain the logging blocker and investigate without
silently widening IAM permissions.

No deployment, invocation, customer-state operation, push, new CI run, submission
or video publication occurred in this review-preparation turn. The preceding
KMS deployment remains live and successful for the disabled paths.

[Machine-readable evidence](enrollment-system-logs-review-2026-09-06.json).
