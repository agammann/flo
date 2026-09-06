# Customer deployment artifact bucket — review only

> Historical review checkpoint. The owner subsequently approved execution, including the three storage-feature omissions, and the bucket was created and live-verified. See [deployment evidence](customer-artifacts-deployment-2026-09-05.md). Statements below about the unexecuted change set describe the earlier review, not current deployment status.

## Outcome and authority

On September 5, 2026, the owner reaffirmed that Flo should proceed without a Lambda DLQ or customer VPC for its current synchronous design. Those existing exceptions remain scoped to the narrator and customer HTTP workflow. They do not automatically approve unrelated storage-policy exceptions.

The owner had separately approved validation of `infra/aws/customer-staging/artifacts.yaml` and preparation of a review-only `flo-customer-artifacts` change set. That plan is now prepared in account `114599789754`, region `us-west-2`. **It has not been executed. No bucket or customer website was created, and no app artifact was uploaded to S3.** The live narrator was not changed or invoked during this review. Submission and video publication remain paused.

## Exact plan

- Template SHA-256: `5389620a04cd528eaa7940983ed629323454accb689c07683405e294e060d290`.
- Change set: `flo-artifacts-review-20260905`.
- Change-set ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-artifacts-review-20260905/ff127a0f-df3f-4a2f-a2a0-c432a5dcbb27`.
- Stack ARN: `arn:aws:cloudformation:us-west-2:114599789754:stack/flo-customer-artifacts/4fb03040-a984-11f1-804f-02b7fbee76d1`.
- Change set: **CREATE_COMPLETE / AVAILABLE**.
- Stack shell: **REVIEW_IN_PROGRESS**. This is a CloudFormation planning record, not a provisioned S3 bucket.
- Changes: add `Artifacts` (`AWS::S3::Bucket`) and `ArtifactsPolicy` (`AWS::S3::BucketPolicy`); no modifications, removals or replacements.
- `describe-events` reported CREATE_CHANGESET SUCCEEDED at `2026-09-05T23:48:39.399000+00:00`, with no VALIDATION_ERROR events.
- S3 bucket inventory was still empty after preparation.

The template uses an AWS-generated bucket name, all four public-access blocks, ACLs disabled through BucketOwnerEnforced, default SSE-S3/AES256 encryption, versioning and a bucket/object-scoped deny for insecure transport. The bucket is retained on deletion or replacement. Incomplete multipart uploads are aborted after seven days; object versions have no automatic expiration. No KMS key, queue, VPC, NAT gateway, replication role or additional logging bucket is proposed.

## Validation evidence

- The unchanged local and CloudShell template hashes matched.
- cfn-lint **1.52.1**, region us-west-2: **0 errors, 0 warnings, 0 informational findings**, exit 0.
- Guard **3.2.1**, registry commit `7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`, 17 top-level files under `rules/aws/amazon_s3`: **11 PASS, 5 FAIL, 0 not applicable**, exit 19, empty stderr in the final run. Counts reflect evaluated rules, not the number of input files.
- Final raw result is retained in CloudShell at `/tmp/flo-kms-check-D2ZOcU/artifact-guard-final.json`. Temporary CloudShell evidence is not a durable repository attachment; this report records the observed results and reproduction instructions.
- For machine-readable output, this Guard version requires both `--structured` and `--show-summary none` alongside `--output-format json`. Initial output-mode errors were corrected before reading the final results.

No template properties were changed merely to hide a finding. No Guard suppressions were added.

## Finding disposition — proposed, not blanket approval

| Raw finding | Resource | Assessment and next gate |
| --- | --- | --- |
| S3_BUCKET_SSL_REQUESTS_ONLY | ArtifactsPolicy | Checker type mismatch: the pinned rule requires Boolean `false`; the template uses string `'false'` under the IAM Bool operator, matching AWS's documented HTTPS-only example. Preserve the policy; verify actual HTTPS-only enforcement after an approved creation. |
| S3_BUCKET_NO_PUBLIC_RW_ACL | Artifacts | Checker rejects absent AccessControl, even though the template explicitly disables ACLs with BucketOwnerEnforced and enables all public-access blocks. AWS recommends keeping ACLs disabled. Preserve this configuration; verify live ownership/public-access controls after approved creation. |
| S3_BUCKET_DEFAULT_LOCK_ENABLED | Artifacts | Proposed scoped omission: this is rebuildable application packaging, not a compliance/WORM archive. Versioning and retention support rollback but do not prevent an authorized principal deleting versions. Owner acceptance remains required before execution. |
| S3_BUCKET_REPLICATION_ENABLED | Artifacts | Proposed scoped omission: one-region staging artifacts, not the customer/repair database. No cross-region disaster-recovery promise is made. Owner acceptance remains required before execution. |
| S3_BUCKET_LOGGING_ENABLED | Artifacts | Proposed scoped omission: no separate S3 server-access-log bucket for this private deployment store. This means no bucket server-access-log trail is provided; API/Lambda logs are not a substitute for S3 object-access auditing. Owner acceptance remains required before execution. |

These are not five proven vulnerabilities or five automatically mandatory infrastructure additions. They are raw policy findings with workload-specific interpretation. The two checker mismatches are supported by source inspection and AWS documentation, not by a live bucket test. The three feature omissions must be explicitly accepted or implemented before executing this plan. Re-review accepted omissions before production, real customer data, new storage purposes, or October 5, 2026, whichever comes first.

References used:

- [AWS HTTPS-only bucket policy example](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingEncryptionInTransit.html) uses string `"false"` and both bucket and object ARNs.
- [CloudFormation S3 bucket reference](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-s3-bucket.html) marks AccessControl as a legacy property and recommends keeping ACLs disabled.
- [Object Ownership reference](https://docs.aws.amazon.com/AmazonS3/latest/API/API_OwnershipControlsRule.html) states that BucketOwnerEnforced disables ACLs.

## Cost review

AWS Price List API was queried during this review for AmazonS3, us-west-2, Storage, volumeType Standard. SKU `Z3FQZG73HYSPVABR`, effective August 1, 2026, reports **$0.023 per GB-month** for the first 51,200 GB tier. This is a public on-demand storage rate, not an account-specific bill or free-tier guarantee. Requests and applicable data transfer are additional.

Retained object versions each contribute to storage usage; no automatic version cleanup is configured. This plan adds no separate customer-managed KMS key or networking hourly resource. Retention is not a spending cap, and stack deletion would leave the retained bucket. Any cleanup or version deletion needs a separate exact-target review and approval.

## Next authorized boundary

Before execution, obtain owner approval for the exact two-resource plan, its ongoing usage costs and the three scoped feature omissions above. Then recheck account, change-set status and exact template, execute, and verify bucket encryption, versioning, ACL-disabled ownership, public-access blocks and bucket policy. Do not claim live controls solely from CREATE_COMPLETE on the change set.

App packaging/upload, customer runtime deployment, LWA secrets/profile and hosted identity tests remain separate steps. This bucket plan does not expose a website or authorize publication. If the plan is abandoned, recommend removing the unused change set and REVIEW_IN_PROGRESS stack record only after explicit owner approval; neither was deleted during this review.
