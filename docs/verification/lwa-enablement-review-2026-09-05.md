# LWA enablement artifact and change-set review — September 5, 2026 (Pacific)

> Subsequent outcome: the owner approved execution and the update succeeded. LWA is now enabled and pre-login hosted checks passed; real Amazon sign-in awaits the owner-controlled browser step. See [deployment evidence](lwa-enablement-deployment-2026-09-05.md). Unexecuted/disabled statements below describe this earlier review checkpoint.

## Status: review complete, not executed

The owner approved uploading the corrected ZIP privately and preparing a review-only Login with Amazon update. Both completed. **No ExecuteChangeSet call was made. Website login remains disabled.** Customer mappings, repair records, narrator configuration, Devpost and video publication were not changed.

Account `114599789754`, region `us-west-2`. Refreshed STS identified the caller as account root; no new identity was created. A least-privileged deployment identity remains a production improvement.

## Verified upload

- Existing bucket: `flo-customer-artifacts-artifacts-wiyewwqt3d1r`.
- Key: `flo-customer/461f5e1591b7610ba1ba5fa3d681d6fe886386b16bea63ead9781895e600ebb6.zip`.
- Version: `raKQgS0ARCNPg5kSiao.DIgrcXy7KP._`.
- SHA-256: `461f5e1591b7610ba1ba5fa3d681d6fe886386b16bea63ead9781895e600ebb6`.
- Size: **615,855 bytes**; content type `application/zip`.
- S3 checksum: `Rh9eFZG3YQuhul+j1oHW/ohjhrFr6mPq2XgYleYA67Y=`.
- Encryption: `AES256` (SSE-S3).
- Last modified: `2026-09-06T02:28:39+00:00`.

Local and CloudShell ZIP hashes matched before upload. The scoped helper verified the account, bucket region, versioning, all four public-access blocks and nonpublic policy status. A single conditional PutObject with `IfNoneMatch=*`, expected bucket owner and explicit checksum refused overwriting an existing object. HeadObject and GetObject were bound to the returned version, and downloaded bytes matched byte-for-byte. A separate AWS connector HeadObject independently confirmed the version, checksum, size and encryption. No public ACL or presigned URL was created; the old deployment version was preserved.

`scripts/upload-customer-artifact.py` was syntax-checked locally, verified by SHA-256 after CloudShell transfer and exercised successfully by this upload/readback. It does not read secrets, create change sets or execute deployments. Its checksum is `079fd2cb27d547dd40e040558f2bafa1b2056612e3dfbcb270098ae075e8130c`.

The immutable application's prior full build/typecheck/lint, 94 passing tests and isolated Linux package smoke results are in [the package fix report](lwa-config-fix-2026-09-05.md). Application bytes were not changed or rebuilt during this upload/review turn; these are prior package tests, not a new full regression claim.

## Fresh infrastructure validation

CloudFormation Original template, local source and the CloudShell validation file matched; SHA-256 `87d753a04241749a438d24528b3282c8100fe4dd2e686e0bcd15613d5878ad96`. The update uses the previous template unchanged and explicitly binds the six reviewed parameters.

- cfn-lint **1.52.1**, us-west-2: JSON `[]`, exit **0** — **0 errors, 0 warnings, 0 informational findings**.
- Restored the previously approved [official Guard 3.2.1](https://github.com/aws-cloudformation/cloudformation-guard/releases/tag/3.2.1) into a new isolated CloudShell temporary directory after the previous installation was lost. The archive matched GitHub's release checksum `8c66efb19c63e6c2bf26b9a41bbcf2f85baa8a937b01d350940194faaf64cf1d`.
- AWS Guard rules pinned to `7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`; all 39 top-level files from api_gateway_v2, cloudwatch, dynamodb, iam and lambda selected.
- Guard: **21 compliant, 5 noncompliant, 10 not applicable**; raw exit **19**, empty stderr. The initial invocation needed `--show-summary none` with `--structured`; after correcting the invocation, the actual policy check completed.
- Raw Guard JSON: `/tmp/flo-lwa-review-aEm2MD/guard.json`, SHA-256 `2f87b1571fdd06d31c72a1eb5645aed81b86e584efe5f77317122ad258f20be2`. Temporary CloudShell storage is not a durable evidence archive.
- AWS ValidateTemplate succeeded with `CAPABILITY_IAM`.

Every failing rule/resource remains exactly within the [owner-approved staging exceptions](../../infra/aws/customer-staging/policy-exceptions.json), with no new suppression or full-compliance claim:

| Rule | Resources | Existing approved treatment |
| --- | --- | --- |
| CLOUDWATCH_LOG_GROUP_ENCRYPTED | AccessLogs, FunctionLogs | Default at-rest encryption; seven-day minimal logs; no extra customer-managed key |
| DYNAMODB_TABLE_ENCRYPTED_KMS | AuthState, CustomerLinks, CustomerRepairs | AWS-managed encryption and application-encrypted authentication values |
| DYNAMODB_PITR_ENABLED | AuthState | Do not restore old sessions and undo logout |
| LAMBDA_DLQ_CHECK | CustomerFunction | Synchronous HTTP; no asynchronous sources |
| LAMBDA_INSIDE_VPC | CustomerFunction | No private-network dependencies |

These exceptions require re-review before production/real repair data, on changed assumptions, or by October 5. The proposed first hosted test is a controlled unlinked-account test, not authorization to serve real customer repairs.

## Exact change set

- Name: `flo-customer-lwa-review-20260906T023152Z`.
- ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-customer-lwa-review-20260906T023152Z/f4eb1cef-5d0c-42ad-8ed0-b42ffed26688`.
- Stack: `flo-customer-staging`.
- Type UPDATE; status **CREATE_COMPLETE**; execution status **AVAILABLE**.
- Creation time: `2026-09-06T02:32:03.568000+00:00`.
- Change-set-scoped DescribeEvents: CREATE_CHANGESET SUCCEEDED at `2026-09-06T02:32:11.262000+00:00`, **zero VALIDATION_ERROR events**.

DescribeChangeSet with property values showed exactly **one Modify**, `CustomerFunction` / `flo-customer-staging-http`, **Replacement=False**, all details **RequiresRecreation=Never**. A recursive comparison of before/after property contexts found exactly these five changed paths; sensitive values were withheld before producing tool or evidence output:

| Property | Change if separately executed |
| --- | --- |
| Code.S3Key | Old `744a3e67...` ZIP to corrected `461f5e15...` ZIP |
| Code.S3ObjectVersion | Old version to `raKQgS0ARCNPg5kSiao.DIgrcXy7KP._` |
| Environment.Variables.LWA_ENABLED | `false` to `true` |
| Environment.Variables.LWA_CLIENT_ID | Empty to registered public ID `LWA_CLIENT_ID_REDACTED_FROM_PUBLIC_EVIDENCE` |
| Environment.Variables.LWA_CLIENT_SECRET | Add the existing template's dynamic reference to JSON field `clientSecret` in `flo/customer-staging/lwa`; no literal credential in parameters/source |

No additions, removals, replacements, IAM changes, table/log changes, concurrency changes, VPC/DLQ additions or narrator changes appear. Reserved concurrency remains **3**; existing API rate **2**, burst **5**, table limits and retention settings remain unchanged in the inspected template/plan.

DescribeSecret confirmed existing version `7562a864-a5c7-4bb7-950e-94816eece7ae` as AWSCURRENT with no scheduled deletion. No GetSecretValue/BatchGetSecretValue call was made. Metadata verification is not Amazon credential validation. The earlier credential disclosure and recommended rotation remain in [the provisioning record](lwa-secret-provisioning-2026-09-05.md).

## Costs and approval boundary

The update adds no new key, secret, table, API, log group, network resource or concurrency reservation. It uses the existing paid staging resources and stored secret. The newly retained artifact adds S3 storage/request usage. Enabling real sign-in can increase Lambda/API Gateway, DynamoDB authentication-state, logging and secret-resolution API usage; exact total depends on traffic. Existing throttles and limits are **not a hard dollar-spending cap**. The narrator and its allowance are outside this operation.

Final live reads still show `UPDATE_COMPLETE`, unchanged last-update time, old ZIP/version, `LwaEnabled=false`, empty client-ID/secret-reference parameters and reserved concurrency **3**. See [selected nonsecret evidence](lwa-enablement-review-2026-09-05.json).

Request separate approval to execute this exact change set and perform bounded hosted checks. After execution, verify successful stack completion and code/config identity without printing environment secrets, then test the real Amazon authorization/callback with the owner controlling sign-in. An unlinked account must not gain repair access. Independently verified customer mappings, real linked-customer isolation, official Alexa+ linking/certification, GitHub release evidence, submission and video publication remain separate gates. Publication and submission stay paused.
