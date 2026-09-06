# Enrollment storage execution review — not execution approval

Account 114599789754, region us-west-2. The owner approved carrying forward the same narrow encryption/recovery treatment and creating this review-only change set. The owner has not yet approved executing this specific resource plan.

## Exact proposed changes

Stack: `flo-customer-enrollment-state` (new stack, CREATE change set).

Change set: `flo-enrollment-state-review-20260906T062545Z`.

ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-enrollment-state-review-20260906T062545Z/ef856f54-d6aa-4406-9a41-2dc4ae6e14e5`.

Template: `infra/aws/customer-enrollment/state.template.json`, SHA-256 `573fe2694bab405740ab93f71c0b912b3c667229ca7f2bbf6e60e9db9d84f775`.

DescribeChangeSet returned CREATE_COMPLETE / AVAILABLE. Exactly three Add actions: EnrollmentRequests, EnrollmentApprovals, EnrollmentAudit; all AWS::DynamoDB::Table. No Modify, Remove or replacement actions. No parameters or IAM capabilities. Change-set-scoped DescribeEvents returned a SUCCEEDED CREATE_CHANGESET operation and no VALIDATION_ERROR events. This verifies the planning operation, not resource creation.

Each table is Standard/on-demand with a generated name, string id key, server-side encryption enabled using the AWS-managed DynamoDB key, deletion protection and Retain policies. TTL uses the ttl attribute. MaxReadRequestUnits is 10 and MaxWriteRequestUnits is 5 per table. Requests/approvals have PITR disabled; audit has seven-day PITR, with application records expiring after 30 days and asynchronous TTL cleanup. No new customer-managed keys, streams, replicas or indexes.

This does not change existing stacks, create functions/roles/API routes, grant operator access, issue credentials, seed records, map customers or start an enrollment workflow. Three empty storage resources alone will not finish the customer-pairing feature.

## Current policy review

The owner explicitly approved carrying forward only the existing treatment to this exact retention revision: AWS-managed encryption on all three tables; no PITR on transient requests/approvals; audit PITR retained at seven days. Raw Guard remains FAIL with the same two rules/eight leaf findings. No findings were suppressed, no extra exception was accepted and no blanket deployment authorization is implied. [Fresh validation](enrollment-retention-validation-2026-09-05.json) and [earlier rule/property analysis](enrollment-state-cloudshell-validation-2026-09-05.md) remain available. The historical manifest/checker stays pinned to its old source; this separate review records the new-hash treatment.

## Ongoing costs

AWS Price List API was refreshed at 2026-09-06T06:28:10Z for Oregon. [Raw rate data](enrollment-state-pricing-2026-09-05.json) preserves all returned products. Relevant public on-demand rates:

- Standard reads: $0.125 per million read request units.
- Standard writes: $0.625 per million write request units.
- Standard storage: $0.25 per GB-month beyond the listed free-storage tier; do not assume available account credits or free allowance.
- Audit PITR: $0.20 per GB-month of billed table size. A seven-day recovery window does not reduce the PITR rate compared with a longer window.
- A future restore would be separately billed at the returned $0.15 per GB restored; no restore is proposed or authorized here.

Request units are not workflow counts: transactional operations and larger items consume additional units. AWS-managed KMS use, other account services and any future runtime deployment can add charges. These throughput settings are not a hard dollar cap. Retained tables and backups can continue accruing charges after a stack deletion; cleanup requires a separate reviewed action. See [AWS DynamoDB pricing](https://aws.amazon.com/dynamodb/pricing/). This is a rate review, not a guaranteed monthly bill or account-wide cost audit.

## Execution and verification gate

Ask for explicit approval of this exact change set before ExecuteChangeSet. Recheck its status/changes and expected account immediately before execution. If approved, wait for completion and verify all three actual tables, TTL, SSE, recovery, throughput and protection settings without reading customer data. Do not run writes, attach permissions or connect the live website as an incidental step.

The public source commit `cbf94e54ccefe4f12a08934023c320521e983757` passed [CI run 34016526840](https://github.com/agammann/flo/actions/runs/34016526840). This includes verify and Docker demo jobs; it does not prove deployed enrollment, Alexa+ linking or a replacement video. Devpost and video publication remain separately gated.
