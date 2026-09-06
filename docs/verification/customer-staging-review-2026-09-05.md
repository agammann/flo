# Customer staging artifact and change-set review — September 5, 2026 (Pacific)

> Historical review-only checkpoint. The owner subsequently approved execution and the stack reached CREATE_COMPLETE. Serial HTTPS checks passed, but parallel assets reproduced throttling. See [deployment evidence and remaining blocker](customer-staging-deployment-2026-09-05.md). Unexecuted-stack statements below describe this earlier checkpoint.

## Outcome and authorization

The owner approved uploading the exact verified customer ZIP to the existing private artifact bucket and preparing a **review-only** customer staging change set with Login with Amazon disabled. These operations completed September 6, 00:13–00:17 UTC (September 5 Pacific). **The customer change set was not executed.** No customer website, database, generated secret, LWA profile, customer mapping or repair record was created by this preparation. Devpost submission and video publication remain paused.

Account `114599789754`, region `us-west-2`; refreshed STS identified the CloudShell caller as account root. A least-privileged deployment identity remains a production improvement; this operation did not create another identity. The live narrator, allowance and configuration were not modified or invoked.

## Verified private artifact

- Bucket: `flo-customer-artifacts-artifacts-wiyewwqt3d1r`.
- Key: `flo-customer/744a3e67d9bc003479cbf95d015b6ac3d696cae7ae687e5b36a7514610a57cc3.zip`.
- VersionId: `3pbmv1gha2sCK7UPUi7bZ_1q8QjtPPTX`.
- SHA-256: `744a3e67d9bc003479cbf95d015b6ac3d696cae7ae687e5b36a7514610a57cc3`.
- Size: **615,803 bytes**; content type `application/zip`.
- S3 full-object checksum: `dEo+Z9m8ADR5y/ldAVtqw9aWyueuaH5bNqdRRhClfMM=`.
- Encryption readback: `AES256` (SSE-S3).
- LastModified: `2026-09-06T00:13:19+00:00`.

Before upload, the source hash matched, bucket versioning was Enabled, all four public-access blocks were true, and HeadObject returned 404 for this key. PutObject used the expected bucket owner, checksum, SSE-S3, and `If-None-Match: *` to refuse overwriting an existing object. No public ACL or presigned URL was created.

HeadObject and GetObject were bound to the returned VersionId. Downloaded bytes compared identical with `cmp`, and the downloaded SHA-256 matched. Version listing showed exactly this one current version and no delete markers for this key. Packaging, source provenance and the prior 93-test suite are recorded in [the package report](customer-package-2026-09-05.md); this turn did not change application or template bytes.

## Fresh template checks

Local, CloudShell and CloudFormation Original-template readback all have SHA-256 `193c9ff75f88db2661ba9d6aa0c354d4cddefdda99fc51341477f472252deafa` for `infra/aws/customer-staging/template.yaml`.

- cfn-lint **1.52.1**, region us-west-2: **0 errors, 0 warnings, 0 informational findings**, JSON `[]`, exit 0.
- CloudFormation Guard **3.2.1**, AWS registry commit `7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`, 39 top-level rule files from api_gateway_v2/cloudwatch/dynamodb/iam/lambda: **21 PASS, 5 FAIL, 10 not applicable**, exit 19, empty stderr.
- AWS ValidateTemplate succeeded and identified `CAPABILITY_IAM`.

The five raw failures remain exactly within the owner-approved [staging exceptions](../../infra/aws/customer-staging/policy-exceptions.json):

| Rule | Affected logical resources | Accepted treatment |
| --- | --- | --- |
| CLOUDWATCH_LOG_GROUP_ENCRYPTED | FunctionLogs, AccessLogs | Default at-rest encryption, seven-day minimal logs; no extra customer-managed key. |
| DYNAMODB_TABLE_ENCRYPTED_KMS | AuthState, CustomerLinks, CustomerRepairs | SSEEnabled true with AWS-managed key management; auth payloads additionally application-encrypted. |
| DYNAMODB_PITR_ENABLED | AuthState | No session backups/restores that could undo logout; links and repairs retain seven-day PITR. |
| LAMBDA_DLQ_CHECK | CustomerFunction | Synchronous HTTP workflow, no async event sources. |
| LAMBDA_INSIDE_VPC | CustomerFunction | No private-network dependency; TLS and application identity/ownership enforcement. |

No suppression or blanket compliance claim was added. Exceptions require review by October 5 or earlier on changed assumptions, including before production or real customer data.

## Exact review-only change set

- Stack: `flo-customer-staging`.
- Change set: `flo-customer-staging-review-20260906T0017Z`.
- ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-customer-staging-review-20260906T0017Z/640ddf37-908b-4f8c-883b-1b70f3a69d51`.
- Stack ARN: `arn:aws:cloudformation:us-west-2:114599789754:stack/flo-customer-staging/1001b5f0-a988-11f1-ac90-06f537c629f7`.
- Type CREATE, capability IAM, status **CREATE_COMPLETE**, execution status **AVAILABLE**.
- Actual CreationTime: `2026-09-06T00:15:27.512000+00:00` (the descriptive name is not the authoritative creation timestamp).
- `describe-events` scoped to the change set: CREATE_CHANGESET SUCCEEDED at `2026-09-06T00:15:31.633000+00:00`, **no VALIDATION_ERROR events**.
- Stack is **REVIEW_IN_PROGRESS**, Outputs null. There is no deployed HTTPS address yet.

Read-back parameters bind the exact bucket/key/version above, `LwaEnabled=false`, `LwaClientId=''`, `LwaSecretId=''`. No secret values were retrieved or supplied.

Script-counted plan: **14 Add, no Modify or Remove**:

| Logical resources | Proposed effect if separately executed |
| --- | --- |
| AuthState, CustomerLinks, CustomerRepairs | Three retained, deletion-protected on-demand DynamoDB tables, each capped at 10 read / 5 write request units. Auth TTL and no auth PITR; seven-day PITR for links/repairs. |
| StateEncryptionKey | One retained generated Secrets Manager encryption key; value must not be printed. |
| CustomerApi, CustomerIntegration, CustomerRoute, CustomerStage, CustomerInvokePermission | Public HTTPS landing/legal assets and app-authorized customer routes; HTTP API throttle rate 2, burst 5, exact API/source-account invocation permission. |
| CustomerFunction | Node.js 22, x86_64, 512 MB, timeout 25 seconds, reserved concurrency **1**, exact immutable ZIP. |
| FunctionLogs, AccessLogs | Seven-day retained logs. Access fields are request ID/status/latency, not payloads or credentials. |
| CustomerRole, CustomerRuntimePolicy | Narrow Lambda role: auth-state Get/Put/Delete, links Get only, repairs Get/Query only, writes only to its function log group. No repair/link write permission or Bedrock invocation. |

No DLQ, customer VPC, NAT, customer-managed KMS key or narrator update appears in this plan. Public transport is intentional for landing/OAuth; it does not authorize customer records. Login disabled and empty link/repair tables mean this first deployment would not provide working Amazon sign-in or repair access.

## Capacity and ongoing cost review

Fresh Lambda account settings: `ConcurrentExecutions=1000`, `UnreservedConcurrentExecutions=998`. The proposed reservation of 1 fits; recheck immediately before execution. No quota request or live reservation was changed here.

Public USD pricing refreshed in this review, before credits, taxes or discounts:

- One generated state secret: **$0.40 per secret-month**, plus Secrets Manager API usage. No separate LWA secret is included yet. [Official pricing](https://aws.amazon.com/secrets-manager/pricing/).
- Link/repair PITR in Oregon: **$0.20/GB-month** of protected storage; restore charges additional. Price List API returned SKU `UKQHCFER4QFSMKMD`, usage `USW2-TimedPITRStorage-ByteHrs`, USD `0.2000000000`/GB-Mo. [DynamoDB pricing](https://aws.amazon.com/dynamodb/pricing/).
- Reserved concurrency has **no separate reservation fee**; invocation and compute usage remain billable. This is not provisioned concurrency. [Lambda documentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html).
- API requests, Lambda duration, database requests/storage, logs, artifact storage/requests and data transfer are additional. No measured traffic forecast or total monthly bill is claimed. Existing narrator costs are separate and unchanged.

Throttles, database throughput settings and concurrency limits are **not a hard dollar-spending cap**. Retained tables, secret, logs and artifact versions may continue to incur costs after stack deletion. No new customer-managed-key or NAT charge is introduced by this plan.

## Next approval boundary

Ask for separate approval to execute this exact customer change set, which would create billable resources and publicly expose the limited staging landing/privacy/terms pages identifying Alexander Ammann and xyes47314@gmail.com. Keep LWA disabled; do not seed links/repairs or create LWA credentials as part of that execution. Verify live code identity, configured controls, log delivery, static routes and rejected customer/Alexa access without printing environment values.

Real hosted Amazon sign-in, trusted test ownership mapping, official Alexa+ account linking/tooling, production certification, fresh GitHub Actions and replacement-video review remain separate unfinished gates. Submission and video publication stay paused.

Raw nonsecret upload/validation/change-set outputs are in temporary CloudShell directory `/tmp/flo-customer-upload-rzWXA0`. This repository records observed evidence, not a guarantee that temporary files will persist. Only documentation changed locally this turn; `git diff --check` is the appropriate fresh local check, not a new claim that the application test suite was rerun.
