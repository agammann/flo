# Narrator hardening deployment — September 5, 2026

## Verified outcome and scope

With separate, explicit owner approval, change set `flo-hardening-kms-caller-20260905` was executed in account `114599789754`, region `us-west-2`. Stack `flo-bedrock-narrator` reached **UPDATE_COMPLETE**. The operation's failed-events query returned an empty list. Customer staging, Login with Amazon configuration, Devpost submission and video publication were not included or executed.

This supersedes the execution blockers in the earlier [hardening review](aws-hardening-review-2026-09-05.md); that report remains a historical checkpoint.

## Exact source and reviewed change

- Template SHA-256, verified before execution and against the live template afterward: `c3492503ed6174aa6a2d934590ce2d879e4d15d74eb34b7cfe5bbaf4fbef36c8`.
- Change-set ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-hardening-kms-caller-20260905/beee7841-fcfb-4b25-8fd9-b9eb63429e08`.
- Execution client request token: `flo-kms-caller-20260905-owner-approved`.
- Reviewed plan: four additions and six modifications; no removals or replacements.
- Additions: two retained KMS keys, API access-log group and runtime managed IAM policy.
- Modifications: allowance table, function configuration, integration, existing Lambda log group, runtime role and API stage.
- Lambda code SHA-256 remained `FTNFquFpit4yD+e0vCJXDHrE9q+3iyePAl7KdWNrdGc=`. This was a hardening/configuration update, not a new model or customer application release.

The final source correction scopes the log-key caller grant to the exact narrator role, account, regional CloudWatch Logs service and Lambda log-group encryption context. `kms:DescribeKey` is separated from context-bound cryptographic operations because that metadata operation does not supply the encryption context. The existing scoped Logs service-principal grant remains. Independent read-only investigation and post-patch review found no remaining concrete defect in this correction.

## Pre-execution verification

- Full workspace build and typecheck passed for 13 configurations.
- Regression suite: **93 passed, 0 failed, 0 skipped**, across 16 suites. ESLint passed with zero warnings allowed.
- The new caller-policy regression failed before the correction and passed afterward.
- cfn-lint 1.52.1: no errors, warnings or informational findings.
- Guard 3.2.1, registry pinned to `7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`: original service selection 24 PASS / 2 FAIL / 10 not applicable; additional KMS selection 2 PASS / 0 FAIL. The two raw failures are the existing owner-approved, resource-scoped synchronous no-DLQ/no-VPC exceptions, reviewed by October 5.
- `check-narrator-kms-policy.py`: ten scenarios, 56 IAM action decisions passed. Valid service/context operations were allowed; wrong or absent context/account/service, direct KMS calls and administrative operations were denied. This isolates caller-policy condition behavior; it is not a simulation of the entire live KMS authorization system.
- CloudFormation change-set validation reported success with no validation-error events. Account, exact template hash, resource changes and available concurrency were rechecked immediately before execution.

## Live settings read back after deployment

| Control | Observed result |
| --- | --- |
| Stack / function | UPDATE_COMPLETE; function Active; LastUpdateStatus Successful |
| Function limits | Reserved concurrency 2; memory 256 MB; timeout 8 seconds |
| Regional concurrency | Applied total 1,000; unreserved 998 after this reservation |
| API route | `POST /narrate`, `AWS_IAM` authorization |
| API throttle | Rate 1 request/second, burst 2; best-effort throttle, not guaranteed spending limit |
| Lambda and API logs | Seven-day retention; same enabled customer-managed Logs KMS key |
| Logs key | `952aa60c-3241-41fc-829a-70fb945dcf2b`; automatic rotation enabled, 365 days |
| Allowance table | ACTIVE; deletion protection enabled; KMS encryption enabled |
| Table key | `b6e5abe9-7c6b-4511-9ffb-5e2b65470bd1`; enabled; automatic rotation enabled, 365 days |
| Table recovery | PITR enabled; seven-day recovery window |
| IAM role | No inline policies; narrator runtime managed policy plus existing AWSLambdaBasicExecutionRole attached |

The separate request for a quota of 1,001 still reported CASE_OPENED at this check. The applied quota of 1,000 independently cleared the deployment prerequisite; this report does not claim the 1,001 request was approved. No quota request was changed during execution.

## Bounded live HTTP checks and log delivery

`scripts/smoke-narrator-aws.py` used the existing CloudShell credential chain without exposing credentials. It was explicitly allowed one model attempt and did not retry or refill the ledger.

| Request | Result | API request ID | Allowance effect |
| --- | --- | --- | --- |
| Unsigned request | 403 | `DP7w8gQHPHcESTQ=` | None |
| Signed, invalid option count | 400 | `DP7xIiIsvHcESsA=` | None |
| Signed, valid synthetic comparison | 200 | `DP7xbjXPvHcES-w=` | Exactly one attempt |

Remaining allowance changed from **99 to 98**, and used count from **1 to 2**. No reset, refund, exhaustion test or restore was performed. The valid response used `amazon.nova-lite-v1:0` and passed the qualitative, no-numbers output contract.

Fresh API access-log records were read back for all three request IDs at 23:31:55–23:31:59 UTC. Their only fields were request ID, HTTP status and response latency. Fresh Lambda REPORT records were also read back at 23:31:57.782 and 23:32:00.006 UTC. The first recorded an initialization duration; these were not merely old log streams. Both encrypted log groups therefore received new records after the update. No request bodies, credentials or customer repair data were logged by the API access-log format.

## Costs, residual limits and next gates

The owner approved an initial **$2/month for two customer-managed keys**, plus KMS requests, backup storage, logging and existing workload usage. Rotation can introduce additional key-material charges. Retained resources can continue to incur costs. These controls are **not a hard account-wide dollar spending cap**.

PITR restore procedures were reviewed in source, not exercised against the live allowance table. A restore must reconcile consumed allowance and must never silently replenish it. See [recovery runbook](../../infra/aws/bedrock-narrator/recovery.md).

CloudShell's observed deployment identity was the account root. No credentials were printed or new identities created; a least-privileged non-root deployment identity remains a production operational improvement.

This verifies the narrow AWS narrator integration only. Customer staging is not deployed; hosted LWA sign-in, trusted customer links, separate Alexa+ account linking and official certification checks remain outstanding. The private artifact-bucket template has syntax validation but its Guard findings still require disposition before an execution request. No artifact bucket was created or app uploaded. Submission and video publication remain paused for separate final approval.
