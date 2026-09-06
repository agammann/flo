# Enrollment runtime: uploaded artifacts and ready change set

2026-09-06. **Approved preparation completed; deployment NOT executed.**

## Artifact evidence

The three previously reviewed ZIPs were uploaded to
`flo-customer-artifacts-artifacts-wiyewwqt3d1r` using short-lived, checksum-bound
PUT URLs and `If-None-Match: *`. Each returned HTTP 200. No existing object was
overwritten. URLs were not saved in this repository or verification evidence.

Independent version-specific `HeadObject` calls verified full-object SHA-256,
content length, AES256 encryption and version IDs:

| Artifact | Bytes | Immutable S3 version |
| --- | ---: | --- |
| request | 381833 | `pDJYZlwxmDpZWHvP7s5X9I0E6hoxtbx3` |
| redemption | 343735 | `9LGMg3B2vKZVtX7sDhuRJt91NuLE1fdT` |
| approval | 339605 | `H_J.f3_uo0_XhbMl4HzQsm7aBw4UYl38` |

Exact keys and checksums are retained in [machine-readable evidence](enrollment-runtime-changeset-2026-09-06.json).
Runtime source is unchanged at `86139591cdc6f0c10b89055dba078788101e14f7`.
Template hash remains `a037959dc25edbb0063fdff78a03bb0815c512b308ecd5408c47c3a58fc56dde`.

## AWS review record

Stack: `flo-customer-enrollment`, account `114599789754`, us-west-2.

Change set: `flo-enrollment-runtime-review-20260906T143900Z`.

ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-enrollment-runtime-review-20260906T143900Z/466decba-5303-4a2c-acaf-343cf5714aaa`.

AWS reports `Status=CREATE_COMPLETE`, `ExecutionStatus=AVAILABLE`.
The stack is `REVIEW_IN_PROGRESS`, not a deployed runtime.
`DescribeEvents` returned a successful CREATE_CHANGESET operation and no
VALIDATION_ERROR events. Pre-deployment property/name-conflict checks therefore
have no reported failures; S3 emptiness is not applicable because no bucket is
removed. This does not replace runtime tests or erase the earlier raw Guard failures.

The actual change set contains exactly 18 Add actions:

- Three Lambda functions and three immutable published versions.
- Three execution roles, three generated baseline policies and three boundaries.
- Three log groups with seven-day retention in the reviewed template.

There are no Modify/Remove actions, replacement operations, API routes,
integrations, invocation permissions, database changes or operator grants.
The change-set parameter readback confirms `EnableEnrollment=false`,
`PublishRoutes=false`, and `EnableApproval=false`. The request supplied
`ApprovalDesignation=null`; AWS masks this NoEcho field in readback. No customer
designation or identity mapping was created.

Existing table names, API origin and public LWA client ID are reused. The public
client ID is omitted from repository evidence to avoid the prior secret-scanner
false positive. No LWA secret or auth-state encryption value was fetched;
CloudFormation retains the reviewed dynamic reference for deployment-time use.

## Cost and execution scope for separate approval

Live Oregon public Price List rates checked at 14:40 UTC:

| Meter | Public first-tier rate |
| --- | --- |
| Lambda x86 duration | $0.0000166667 per GB-second |
| Lambda requests | $0.20 per million |
| CloudWatch standard custom-log ingestion | $0.50 per GB |
| CloudWatch log storage | $0.03 per GB-month |

Reserved concurrency one per function is not provisioned concurrency and has no
additional reservation charge. Each function has 256 MB memory; request timeout
is 20 seconds and private-function timeouts are 10 seconds. No VPC, NAT gateway,
DLQ, new database, new secret or customer-managed KMS key is added. Existing
storage, backups, secrets, narration and other account usage continue separately.

A script-calculated illustration for 12 calls at 256 MB and 20 billed seconds
each is $0.001002402 in Lambda duration/request charges, before allowances,
discounts and taxes. This is not a guaranteed bill or overall spending cap:
initialization/billing details, logs, secret resolution, S3 requests and other
usage remain applicable. The previously documented artifact storage cost continues.

References: [Lambda prices](https://aws.amazon.com/lambda/pricing/),
[reserved concurrency](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html).

If separately approved, execute ONLY this change set, inspect all created
settings/roles/version hashes, and make at most 12 synchronous disabled-state
test invocations using synthetic inputs, without writing customer records or
enabling any processing. Inspect log delivery and document any lack of evidence;
do not label missing WARN-level log events a successful delivery test. The
unresolved log-stream simulation discrepancy remains a required live-verification
item before public routes are enabled. Do not widen permissions without review.

No execution is authorized by this document. If the owner declines deployment,
the review-only stack record and artifacts remain; cleanup needs separate explicit
approval and exact-target checks. Devpost submission, video publication,
operator access, customer linking and official Alexa+ certification remain gated.
