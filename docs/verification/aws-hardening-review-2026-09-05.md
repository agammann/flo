# AWS hardening and customer staging review — September 5, 2026

> Historical pre-execution checkpoint. Later on September 5, the revised narrator template was separately approved, deployed and live-verified; the applied quota was 1,000. See [narrator deployment evidence](narrator-kms-deployment-2026-09-05.md). The blockers and hashes below describe the earlier snapshot, not current narrator deployment status. Customer staging remains undeployed.

## Outcome and authority

Validation tooling was restored in an isolated CloudShell directory with explicit owner approval. Both original, unchanged templates were validated. A review-only UPDATE change set was prepared for the existing narrator. **No change set was executed and no customer stack was created.** Submission and video publication remain paused.

The owner separately approved the customer staging policy exceptions described below. This is not approval to execute infrastructure changes. The applied concurrency quota still blocks both proposed reservations. Static validation does not prove runtime IAM/KMS interoperability or hosted Login with Amazon.

## Source and tooling

Account: `114599789754`; region: `us-west-2`. STS identified the current CloudShell caller as the account root. A least-privileged non-root deployment identity should be established/reviewed before production; no new identity was created in this check.

| Template | SHA-256 |
| --- | --- |
| `infra/aws/bedrock-narrator/template.yaml` | `4d5b66e5d4db46fff2aac2d0ddb5971ee58bcd0988c6595d0b51c84d7dd34d71` |
| `infra/aws/customer-staging/template.yaml` | `193c9ff75f88db2661ba9d6aa0c354d4cddefdda99fc51341477f472252deafa` |

Local and uploaded template hashes matched. Only the nonsecret templates and existing narrator exception record were uploaded in `flo-infra-review-20260905.tar.gz`, SHA-256 `433e3c96a565f88da984d7936771a2633c19cb6dd8ee9120f35a1ff135cff1da`.

- The former `/tmp/flo-cfn-d8K7rv` tooling directory was gone; historical reports referencing it remain historical evidence, not available tool installations.
- New isolated directory: `/tmp/flo-infra-review-BA4Q1s`.
- Available cfn-lint: **1.52.1**. The earlier report used 1.56.0; this run does not claim that version.
- CloudFormation Guard: **3.2.1**, restored from the official AWS GitHub release. Download SHA-256 `8c66efb19c63e6c2bf26b9a41bbcf2f85baa8a937b01d350940194faaf64cf1d` matched the release metadata.
- AWS Guard registry pinned to `7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`; original service selection: top-level `.guard` files in `api_gateway_v2`, `cloudwatch`, `dynamodb`, `iam`, and `lambda`. KMS rules were run separately on the narrator.

## Syntax and policy results

cfn-lint on both templates with region `us-west-2`: **0 errors, 0 warnings, 0 informational findings**, JSON `[]`, process exit **0**, empty stderr.

| Raw Guard run | PASS | FAIL | Not applicable |
| --- | ---: | ---: | ---: |
| Narrator, original service selection | 24 | 2 | 10 |
| Customer staging, original service selection | 21 | 5 | 10 |
| Narrator, additional KMS selection | 2 | 0 | 0 |

Counts were computed from the structured JSON, not inferred from resource counts. Guard stderr was empty. Passing this selected policy set is not an account-wide compliance certification.

Narrator failures remain `LAMBDA_DLQ_CHECK` and `LAMBDA_INSIDE_VPC`, both confined to `NarratorFunction` and covered by its pre-existing owner-approved exception record. KMS results passed `CMK_BACKING_KEY_ROTATION_ENABLED` and `KMS_NO_WILDCARD_PRINCIPAL`; this is not a live key-health test.

Customer raw failures and independently approved staging treatment:

| Rule | Exact logical resources | Treatment |
| --- | --- | --- |
| `CLOUDWATCH_LOG_GROUP_ENCRYPTED` | `FunctionLogs`, `AccessLogs` | Default encrypted logs, seven-day retention; no new customer-managed keys. |
| `DYNAMODB_TABLE_ENCRYPTED_KMS` | `AuthState`, `CustomerLinks`, `CustomerRepairs` | Keep `SSEEnabled: true` with AWS-managed key management; auth values also use application encryption. |
| `DYNAMODB_PITR_ENABLED` | `AuthState` only | No auth-state backups/restores; require fresh sign-in into a new empty table/key after recovery. Link/repair PITR stays enabled. |
| `LAMBDA_DLQ_CHECK` | `CustomerFunction` | Synchronous HTTP flow with no async event sources. |
| `LAMBDA_INSIDE_VPC` | `CustomerFunction` | No private-network dependency; TLS and application-session/ownership controls remain mandatory. |

The owner approved these policy treatments in this review, **not deployment**. [The separate customer exception record](../../infra/aws/customer-staging/policy-exceptions.json) expires for review on October 5 or earlier when assumptions change, including before production/real repair data. No Guard suppression was added and raw FAIL results were not relabeled PASS.

Local verification after documentation edits: `git diff --check` passed (only existing LF/CRLF conversion warnings), and a Node assertion check passed for all five exception-rule/resource mappings, valid review dates, required controls, resource existence in the template, and absence of suppression metadata. No runtime or template bytes changed in this review, so the prior application suite was not rerun for these documentation-only edits.

Temporary raw-result hashes:

- `narrator-guard.json`: `232c9b1569770fe2d196ff5a8b2494f218d445b4b248ba84e708b30540b7a414`.
- `customer-guard.json`: `6b4239c95035d1f3602f38778260c19bda03428b8d301c6036550629f5af4ad7`.
- `narrator-kms-guard.json`: `078a38cb22c11ddb6d50a0fbb4435155413ae5495d473cae0b820aa0b22f505f`.

These files are in the temporary CloudShell directory; this repository report preserves observed summaries, not the full raw files.

## Live quota and stack checkpoint

- Request `9aee223c1a5b44e9a2d68fd7b3108dae0Lq1YWJJ`: **CASE_OPENED**, desired value **1001**, linked case **178864400000075**, last-updated field `2026-09-05T21:33:25.126000+00:00`.
- Applied `ConcurrentExecutions=10`; `UnreservedConcurrentExecutions=10`.
- Narrator stack remains **IMPORT_COMPLETE** before change-set preparation. Model and API throttle parameters were preserved with `UsePreviousValue=true`.
- No new quota request, model invocation, allowance reset or reservation update was performed.

AWS documents a 100-unit unreserved allowance when assigning reservations. The current applied limit is insufficient for narrator reservation 2 and customer reservation 1. Do not omit reservations or use zero to bypass this gate. [Lambda reserved concurrency](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html).

## Narrator review-only change set

- Name: `flo-hardening-review-20260905T2303Z`.
- ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-hardening-review-20260905T2303Z/278a7428-6222-4e9d-a5c1-c1aaa8bf7183`.
- Type: UPDATE; `CAPABILITY_IAM` acknowledged for planning.
- Status **CREATE_COMPLETE**, execution status **AVAILABLE**.
- `describe-events` scoped to the ARN reported CREATE_CHANGESET **SUCCEEDED** at `2026-09-05T23:02:38.615000+00:00`, with **no VALIDATION_ERROR events**.
- Script-counted plan: **4 Add, 6 Modify**, no Remove. Every Modify has `Replacement: False`.

| Logical resource | Action | Property-level review |
| --- | --- | --- |
| `NarrationAllowanceKey` | Add | Retained rotating KMS key for the allowance table. |
| `NarratorLogsKey` | Add | Retained rotating KMS key constrained to the two narrator log groups. |
| `NarratorAccessLogGroup` | Add | Seven-day minimal API access logs. |
| `NarratorRuntimePolicy` | Add | Managed runtime policy, model invocation and fixed allowance key update. |
| `NarrationAllowance` | Modify | Explicit KMS SSE and seven-day PITR; no replacement. |
| `NarratorFunction` | Modify | Reserved concurrency 2; dynamic role reference; no Code property change listed. |
| `NarratorIntegration` | Modify | Dynamic `IntegrationUri` dependency on the function ARN. |
| `NarratorLogGroup` | Modify | KMS key association; retained existing log-group name/retention. |
| `NarratorRole` | Modify | Remove inline runtime policies in favor of the managed attachment. |
| `NarratorStage` | Modify | Minimal access-log destination and format. |

CloudFormation pre-validation does not prove the quota or runtime permissions are sufficient. The plan is retained for review only and must not be executed as-is while the applied quota is 10. If abandoned or superseded, delete the unused UPDATE change set after approval; do not delete the existing stack.

### Remaining key-permission review

The fresh official CloudWatch guide distinguishes regional Logs service-principal permissions from calling-role KMS permissions for encrypted `PutLogEvents`. The candidate template grants the Logs service access, but the narrator execution role has no explicit Logs-key caller grant. Review and resolve that caller-permission requirement before executing the candidate; static Guard success does not settle it. Also verify the chosen deployment identity can associate the key. No live logging failure is claimed because this key change has not been deployed. [CloudWatch Logs KMS permissions](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/encrypt-log-data-kms.html).

If that review changes the template, rerun lint/Guard and prepare a new change set tied to the new hash. Existing pre-validation evidence applies only to the template hash above.

## Cost review: components, not a total bill

Public rates checked September 5; USD, before taxes, credits, free-tier offsets or discounts. No account billing audit or measured monthly forecast was performed. Python `Decimal` calculated fixed components.

| Proposed component | Public-rate cost |
| --- | --- |
| Two new narrator customer-managed KMS keys | **$2.00/month initially** at $1/key-month, prorated; requests additional. Automatic rotations can add key-storage charges. |
| Customer auth-state secret | **$0.40/month** for one secret, plus API calls. |
| Customer auth-state secret plus a separate LWA client-secret record | **$0.80/month** for those two secrets, plus API calls. No LWA secret has been created. |
| Reserved concurrency | **No separate reservation fee**; function invocations/duration remain billable. This is not provisioned concurrency. |
| DynamoDB PITR in Oregon | **$0.20/GB-month** of protected table storage; restore charges separate. Seven-day recovery does not reduce the PITR storage rate compared with a longer window. |

Sources: [KMS pricing](https://aws.amazon.com/kms/pricing/), [Secrets Manager pricing](https://aws.amazon.com/secrets-manager/pricing/), [Lambda concurrency](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html), [DynamoDB pricing](https://aws.amazon.com/dynamodb/pricing/). The regional PITR rate was also retrieved via the AWS Price List API: `AmazonDynamoDB`, `regionCode=us-west-2`, SKU `UKQHCFER4QFSMKMD`, usage type `USW2-TimedPITRStorage-ByteHrs`, USD `0.2000000000`/`GB-Mo`, effective August 1, publication August 31, 2026.

Additional usage-dependent components include KMS requests, API requests, Lambda duration, database requests/storage, backup restoration, log ingestion/storage, artifact S3 storage/requests and transfer. Those are **not included** in the fixed components above. Retained resources can keep accruing costs after stack deletion. Rate/concurrency/throughput limits and the narrator model allowance are not a hard dollar-spending cap.

## Next gates

1. Resolve the narrator Logs-key caller-permission review and regenerate validation/change-set evidence if source changes.
2. Recheck an actually applied sufficient quota immediately before execution; a pending quota case is not enough.
3. Obtain separate exact narrator execution approval after reviewing the final plan, runtime permissions and costs.
4. For customer staging, select/review a private versioned artifact bucket, verify the immutable bundle, and supply actual bucket/key/version parameters. No customer change set was created with fabricated artifact values.
5. Review the customer change set and costs before approved creation. Start with LWA disabled; configure real LWA privately, verify trusted test mapping and hosted successful/rejected flows, then complete separate official Alexa+ checks.
6. Post-deployment tests must establish actual KMS log delivery, backups, reservations, IAM enforcement and accepted/rejected calls. Preserve the allowance; never refill it to create test capacity.
7. Push tested source and verify fresh CI only after final-source checks; reconcile release text and replacement video. No submission or publication without separate final authorization.

The [CloudShell Docker report](cloudshell-docker-2026-09-05.md) remains the evidence for the successful container workflow and prior 92-test suite. No Docker/runtime implementation was changed in this infrastructure review; hosted sign-in, Alexa+ linking, CI and release are not inferred from those local results.
