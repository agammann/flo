# Narrator policy remediation — September 5, 2026

## Status and scope

Later same-day update: the owner approved **1,001** instead of 102. AWS accepted request `9aee223c1a5b44e9a2d68fd7b3108dae0Lq1YWJJ` as **PENDING**; the applied regional quota was still **10** immediately afterward. Support case `178864359700865` was updated and its saved correspondence verified to supersede the earlier 102 request. No paid support upgrade or workload change was requested. Operator **Alexander Ammann** and the monitored privacy inbox are now owner-confirmed. See the later [deployment preparation report](aws-deployment-preparation-2026-09-05.md) for subsequent gates.

Six of the eight baseline findings are fixed in local source. The two remaining raw Guard failures are the owner-approved, workload-specific DLQ and customer-VPC exceptions, scoped to `NarratorFunction`. **This source has not been deployed.** No live Lambda reservation, key, log group, table backup configuration, IAM attachment or allowance value was changed during this remediation.

Devpost submission and video publication remain paused. Customer hosting/LWA registration is a separate, incomplete workstream. The privacy draft now uses the owner-selected `xyes47314@gmail.com`; no new mailbox was created, and mail delivery/monitoring have not been independently verified.

## Changes

| Baseline finding | Source treatment |
| --- | --- |
| API Gateway access logging | Separate retained log group, seven-day retention, only request ID/status/latency. No request payloads, credentials, identity, IP, path or query logging. |
| Lambda reserved concurrency | Fixed positive cap of 2. Deployment blocked by the regional quota described below; no zero/unbounded workaround. |
| CloudWatch explicit KMS | Retained rotating customer-managed key; regional Logs principal constrained to the exact two log-group encryption contexts. |
| DynamoDB explicit KMS | Separate retained rotating customer-managed key, explicit SSE type/key, runtime decryption constrained to this account's regional DynamoDB table context. |
| DynamoDB PITR | Seven-day recovery window; operator-controlled reconciliation runbook prohibits silently restoring a larger model allowance. |
| Inline IAM policy | Existing runtime statements moved to an attached managed policy; fixed-key UpdateItem condition rejects a missing leading-key context. Runtime has no table-management/restore API. |
| Lambda DLQ | Owner-approved exception: synchronous API, no asynchronous event source. Re-review before any asynchronous path. |
| Lambda customer VPC | Owner-approved exception: IAM ingress, AWS SDK TLS, no private-network dependencies or customer repair payloads. Re-review when assumptions change. |

The reviewed handler remains the conditional-decrement enforcement boundary. `dynamodb:UpdateItem` permission itself cannot prevent different code from refilling the row. Moving that permission to a managed policy does not make the ledger immutable. The inline JavaScript handler was not changed by these policy edits.

Both explicit KMS key choices concern key control, not a claim that the previous defaults were unencrypted. Two customer-managed keys, key requests, PITR and added log ingestion/storage carry potential recurring costs. No exact cost estimate or hard dollar cap is claimed. Retained keys/backups can cost money after stack deletion.

## Exact validation evidence

- Template: `infra/aws/bedrock-narrator/template.yaml`.
- Final SHA-256: `4d5b66e5d4db46fff2aac2d0ddb5971ee58bcd0988c6595d0b51c84d7dd34d71`, matched between the Windows source and isolated CloudShell copy.
- cfn-lint **1.56.0**, `us-west-2`: JSON `[]`, exit **0** on the final template.
- CloudFormation Guard **3.2.1**, same 39 top-level service-relevant rule files as the [baseline](cloudformation-policy-check-2026-09-05.md), pinned AWS registry commit `7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`.
- Final original-selection result: **24 PASS, 2 FAIL, 10 not applicable**; exit **19**, empty stderr. Raw failures: only `LAMBDA_DLQ_CHECK` and `LAMBDA_INSIDE_VPC`. No `SuppressedRules` metadata was added.
- Additional KMS coverage: all three `.guard` files under the pinned registry's `rules/aws/aws_kms` directory were run separately. Guard emitted two rule results, both **PASS** (`CMK_BACKING_KEY_ROTATION_ENABLED`, `KMS_NO_WILDCARD_PRINCIPAL`), exit **0**, no stderr. It did not emit a third rule result; this is not proof of live key-deletion status. Temporary result file: `guard-kms-results.json`, SHA-256 `7cd00904928adc629c6d236a7359d2f824025a235eb4b333575e33e8587637c8`.
- Full Guard JSON is temporarily at `/tmp/flo-cfn-d8K7rv/guard-hardened-results.json`, SHA-256 `aac1e2be27d2f64b6b8e5b71639b212bf9c381edce990977d1919c22bb5f2ab0`. The directory also holds the pinned rule-file list and stderr. Temporary CloudShell files are not durable artifacts; this local report preserves the observed summary.
- An intermediate parameterized concurrency value triggered the registry rule's map-versus-integer comparison limitation. Final source uses literal `2`, which also prevents unreviewed parameter overrides of this cap. Both lint and Guard were rerun after that change.
- Build: all 13 workspace configurations passed. Typecheck: all 13 passed. Final rebuilt tests: **76 passed, 0 failed, 0 skipped across 13 suites**. ESLint passed after excluding only ignored `.private` tooling artifacts from traversal. Regression tests cover the log fields/retention/key associations, positive fixed concurrency, managed-policy boundary, PITR/recovery constraints and exact exception scope. An intermediate direct test-script run used stale compiled tests after the concurrency edit; rebuilding and rerunning the complete suite resolved that artifact mismatch.
- A disposable production-mode fixture with explicit demo opt-in and AWS disabled started at `127.0.0.1:4550`; its root returned HTTP **200**. The owned fixture was then stopped; existing previews were not reset or stopped. This is not a Docker Compose launch.

These are static and local checks, not live KMS/IAM interoperability tests, an account-wide compliance claim, official Alexa+ testing or certification.

## Concurrency quota blocker

Live read-only observations in `us-west-2`:

- `lambda get-account-settings`: `ConcurrentExecutions=10`, `UnreservedConcurrentExecutions=10`.
- `lambda get-function-concurrency` for `flo-bedrock-narrator`: no reservation reported.
- Available hourly `ConcurrentExecutions` maximum datapoints over the inspected September 4–5 interval were all **1**. This limited observed workload supports an initial cap of 2, not a future load guarantee.
- Prior quota request history for `L-B99A9384` was empty.

The owner approved requesting **102** regional concurrency, with no permission to deploy a reservation without change-set review. The request was attempted through `service-quotas request-service-quota-increase` and AWS rejected it with `IllegalArgumentException`: the API requires a requested value greater than its default of **1000.0**. A subsequent history read remained empty; a retry produced the same explicit rejection. This API path created no quota request ID or increased quota. No larger quota was requested.

The same authorized request was then submitted through the signed-in AWS Support console. **Case `178864359700865`**, created `2026-09-05T21:26:37.215Z`, was verified on its Case Details page with status **Unassigned**, severity **General question**, category **Service Quotas, General**, and no additional contacts. The console displays case type **Account** despite selecting the service-limit-increase route. Saved correspondence asks for exactly **102** in `us-west-2`, describes the API error and actual limit of 10, and explicitly declines a larger quota, paid support-plan upgrade or workload changes. The subject is **Lambda us-west-2: request applied concurrency quota 102; API rejects below default 1000**. This is a submitted support request, not an approved/applied quota increase. No support-plan upgrade was made.

The actual low account quota must be resolved with AWS before deploying a reservation. [AWS documents reduced quotas for new accounts](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html) and the [100-unit unreserved requirement](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html). Requesting a materially larger capacity is a separate owner decision. Do not reduce Flo to concurrency zero, silently omit the cap, or treat the failed request as pending approval.

## Remaining deployment gates

1. Resolve the actual regional concurrency quota; recheck enough unreserved capacity immediately before deployment.
2. Review recurring KMS/PITR/log costs and deployment-identity key permissions.
3. Check whether the existing `/aws/lambda/flo-bedrock-narrator` log group needs an **IMPORT-only** change set based on the deployed source, preserving its current settings. Never delete the group to resolve a name collision. Do not mix unrelated hardening updates into resource import.
4. Prepare/review the subsequent update, replacement flags and CloudFormation `describe-events` pre-deployment results; obtain explicit execution confirmation.
5. After execution, verify actual retention, key access, PITR, IAM attachment, quota/reservation and successful/rejected signed/unsigned API behavior. No live model attempt was spent during this static remediation.
6. Use [the recovery runbook](../../infra/aws/bedrock-narrator/recovery.md) for any table restoration. If historical consumption is uncertain, fail closed with zero remaining allowance, rather than automatically refilling it.

Exception details and review date are in [policy-exceptions.json](../../infra/aws/bedrock-narrator/policy-exceptions.json). They expire for review on **October 5, 2026**, or earlier when their architectural assumptions change.
