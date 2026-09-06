# Customer concurrency candidate — September 5, 2026 (Pacific)

Historical pre-execution review. The owner subsequently approved execution; the update and bounded browser/request checks succeeded. See [deployment verification](customer-concurrency-deployment-2026-09-05.md) for current state. Statements below about awaiting approval describe this review checkpoint.

## Status: validated change set available; execution not approved

The owner authorized preparing and validating the customer-only reserved-concurrency change from **1 to 3**, followed by an exact CloudFormation change-set review and separate execution approval. The review-only UPDATE change set is now **CREATE_COMPLETE / AVAILABLE**. **It has not been executed. Live reserved concurrency remains 1.**

This follows the [reproduced browser-load throttling](customer-staging-deployment-2026-09-05.md). Three is a bounded reliability-test candidate, not a verified fix or production-capacity claim.

## Source and live preflight

- Account `114599789754`, region `us-west-2`, stack `flo-customer-staging`: live `CREATE_COMPLETE`.
- `GetFunctionConcurrency` returned 1 for `flo-customer-staging-http`; regional concurrency 1,000 and unreserved concurrency 997.
- Local candidate changes only `CustomerFunction.Properties.ReservedConcurrentExecutions` from 1 to 3.
- Candidate SHA-256: `87d753a04241749a438d24528b3282c8100fe4dd2e686e0bcd15613d5878ad96`.
- Reverting that single line reproduces the exact deployed template SHA-256: `193c9ff75f88db2661ba9d6aa0c354d4cddefdda99fc51341477f472252deafa`. A Node assertion verified the hashes and single occurrence.
- The uploaded archive contains only the nonsecret template; SHA-256 `e751bfe9fda80368b0d139bd2490b573fc282ffec0bcfa3ebeea879e86ce07d4`. CloudShell verified both archive and extracted-template hashes.

The UPDATE change set was created with `UsePreviousValue=true` for all six parameters: `ArtifactBucket`, `ArtifactKey`, `ArtifactVersion`, `LwaEnabled`, `LwaClientId`, and `LwaSecretId`. AWS returned their unchanged values. LWA remains disabled, with empty client ID and secret reference. The deployed ZIP and its exact S3 version remain unchanged. API rate 2/burst 5, database throughput limits, IAM, logs, storage, and narrator configuration are outside this change.

## Completed validation

In the isolated CloudShell directory `/tmp/flo-concurrency-review-WlQBng`, cfn-lint **1.52.1** returned the complete JSON result `[]` with exit code **0** for this candidate, including a fresh region-specific run for `us-west-2`.

After owner approval, restored official [Guard 3.2.1](https://github.com/aws-cloudformation/cloudformation-guard/releases/tag/3.2.1) and AWS rules revision `7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`. The downloaded archive matched GitHub release metadata SHA-256 `8c66efb19c63e6c2bf26b9a41bbcf2f85baa8a937b01d350940194faaf64cf1d`; the installed binary and checked-out revision were read back.

Ran all 39 top-level rule files in the selected API Gateway v2, CloudWatch, DynamoDB, IAM, and Lambda directories with JSON/structured output. Result: **21 PASS, 5 FAIL, 10 not applicable**, raw exit **19**. The complete 33,027-byte raw output is `guard-results.json` in the isolated directory, SHA-256 `8ca0db912a301b1f02ea6ef5b8a7967c251b74f54750bac67dc1a9c9ff48b37e`. This is not a fully compliant raw Guard result. Every failing rule and affected resource matched the existing [approved staging exceptions](../../infra/aws/customer-staging/policy-exceptions.json), without new suppressions:

| Rule | Affected resources | Approved treatment |
| --- | --- | --- |
| CLOUDWATCH_LOG_GROUP_ENCRYPTED | AccessLogs, FunctionLogs | Default encryption, seven-day logs; no extra customer-managed key |
| DYNAMODB_TABLE_ENCRYPTED_KMS | AuthState, CustomerLinks, CustomerRepairs | AWS-managed encryption plus application-encrypted auth values |
| DYNAMODB_PITR_ENABLED | AuthState only | No restoring authentication state that could undo logout |
| LAMBDA_DLQ_CHECK | CustomerFunction | Synchronous HTTP flow; no asynchronous source |
| LAMBDA_INSIDE_VPC | CustomerFunction | No private-network dependencies |

Exceptions remain scoped to staging, with review due October 5 or earlier when assumptions change. `LAMBDA_CONCURRENCY_CHECK` passed. AWS `ValidateTemplate` also succeeded.

## Exact AWS update for approval

- Stack: `flo-customer-staging`, account `114599789754`, region `us-west-2`.
- Change set: `flo-customer-concurrency-review-20260906T014620Z`.
- ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-customer-concurrency-review-20260906T014620Z/986237ee-3afe-46e4-b354-69b27c56e6d7`.
- Creation succeeded at **2026-09-06 01:46:27.102 UTC**; `DescribeChangeSet` returned `CREATE_COMPLETE` and `AVAILABLE`.
- Exactly one `Modify`: `CustomerFunction` (`flo-customer-staging-http`), property `/Properties/ReservedConcurrentExecutions`, before **1**, after **3**; static direct modification, `RequiresRecreation=Never`, `Replacement=False`.
- No resource additions, removals, or replacements. An assertion compared the returned before/after property contexts and confirmed they differ only by this limit. Secret values were redacted by CloudFormation; raw property contexts are not included in the local evidence file.
- Change-set-scoped `DescribeEvents` returned two CREATE_CHANGESET lifecycle events, including SUCCEEDED, and **zero VALIDATION_ERROR events**.
- Final read-only check: live reservation **1**, applied regional quota **1,000**, unreserved **997**. Executing the proposal would reserve two additional units, leaving 995 if no other reservations change.

See the [selected AWS evidence](customer-concurrency-change-set-2026-09-05.json). Execution is a separate approval gate; no ExecuteChangeSet call was made.

## Post-approval verification plan

If the exact update is approved and executed, verify stack completion, reservation 3, unchanged parameters and code checksum. Repeat the bounded parallel asset requests, serial hosted smoke, and actual browser initialization. Correlate request IDs with access logs and Lambda throttling metrics. Preserve the intentional login-disabled response and distinguish it from gateway failures.

Reserved concurrency is not provisioned concurrency and does not prewarm environments. AWS charges no separate reserved-concurrency fee. A larger limit permits more simultaneous billed execution; existing API/database limits do not establish a hard dollar cap. [AWS concurrency documentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html). The inspected change set adds no service, key, table, or log group.

No new complete application regression, actual Amazon login, official Alexa+ validation, GitHub push, Devpost submission, or video publication is claimed. Submission and video publication remain paused.
