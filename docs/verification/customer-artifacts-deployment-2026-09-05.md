# Customer artifact bucket deployment — September 5, 2026

## Outcome

Following explicit owner approval of the exact two-resource plan, ongoing usage costs and three documented storage-feature omissions, `flo-customer-artifacts` reached **CREATE_COMPLETE** in account `114599789754`, region `us-west-2`. The stack's failed-events query returned an empty list.

Created bucket: **`flo-customer-artifacts-artifacts-wiyewwqt3d1r`**.

Only the bucket and its bucket policy were created. No application upload, customer runtime deployment, Login with Amazon setup, Devpost submission or video publication was performed. No existing narrator resource was changed or invoked. No DLQ, customer VPC, NAT gateway or new customer-managed KMS key was created.

## Execution identity and exact source

- Reviewed change set: `flo-artifacts-review-20260905`.
- Change-set ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-artifacts-review-20260905/ff127a0f-df3f-4a2f-a2a0-c432a5dcbb27`.
- Execution client request token: `flo-artifacts-owner-approved-20260905`.
- Template SHA-256: `5389620a04cd528eaa7940983ed629323454accb689c07683405e294e060d290`.
- Immediately before execution, the account, CREATE_COMPLETE/AVAILABLE change-set status, two Add actions and template hash were rechecked. No extra changes were present.
- After deployment, `get-template` on the live stack returned the same exact template hash.
- CloudShell used AWS CLI 2.36.35 and the existing account-root credential chain. Credentials were not printed or placed in files. A non-root deployment identity remains a production operational improvement; no new identity was created in this step.

The [pre-deployment review](customer-artifacts-review-2026-09-05.md) records syntax validation, raw Guard findings, source-supported checker mismatches and the price lookup. It remains a historical checkpoint. The three owner-approved feature omissions are now recorded separately in [artifact-policy-exceptions.json](../../infra/aws/customer-staging/artifact-policy-exceptions.json), with review due by October 5 or an earlier scope change. No blanket Guard suppressions were added.

## Live checks

| Check | Observed result |
| --- | --- |
| CloudFormation stack | CREATE_COMPLETE |
| Failed operation events | Empty list |
| Bucket location | us-west-2 |
| Default encryption | AES256 / SSE-S3 |
| Versioning | Enabled |
| BlockPublicAcls | true |
| IgnorePublicAcls | true |
| BlockPublicPolicy | true |
| RestrictPublicBuckets | true |
| Object ownership | BucketOwnerEnforced; ACLs disabled |
| S3 policy status | IsPublic false |
| Lifecycle | Enabled abort of incomplete multipart uploads after seven days; no object-version expiration |
| Authenticated HTTPS listing | Succeeded; KeyCount 0; IsTruncated false |
| Anonymous HTTPS listing | AccessDenied; CLI exit 254 |
| Version inventory | No versions or delete markers returned |

The policy was fetched from the live bucket and structurally asserted: exactly one Deny statement, Principal `*`, Action `s3:*`, the exact bucket ARN and its `/*` object ARN, and `Bool: {"aws:SecureTransport": "false"}`. That establishes the deployed HTTPS-only configuration. The anonymous denial independently tests public listing protection; it does **not** isolate the HTTPS condition as the reason for rejection. No credentials were sent over plaintext HTTP, and no authenticated HTTP negative test is claimed.

No canary object or application package was uploaded. Consequently this verification does not claim actual object-upload/download, encryption-of-a-written-object, version rollback or Lambda package-consumption tests. Those belong to the next artifact-upload workflow.

## Costs and next gate

The approved review recorded S3 Standard in Oregon at $0.023 per GB-month in the first tier, plus requests and applicable transfer. This is not an account-specific bill or a free-tier guarantee. Retained versions may accumulate storage costs and survive stack deletion; no spending cap or automatic version cleanup is claimed.

Next: prepare and verify the nonsecret customer application ZIP, review its exact contents/hash, then request the separate upload and customer-runtime change-set preparation authority. The customer website is still not deployed. Hosted LWA sign-in and trusted repair-ownership mapping tests, separate Alexa+ integration checks, source publication/CI and final release approvals remain separate work.
