# Enrollment pre-upload review

Checked 2026-09-06 at approximately 14:32 UTC. **No upload, change set creation,
runtime deployment, customer linking or publication performed.**

## Verified inputs

Source: `86139591cdc6f0c10b89055dba078788101e14f7`. The three ZIPs in
`dist/enrollment-packages/20260906T141045Z` still match every size and SHA-256 in
[packaging evidence](enrollment-packaging-2026-09-06.md). Total: 1,065,173 bytes.
Template SHA-256 is unchanged:
`a037959dc25edbb0063fdff78a03bb0815c512b308ecd5408c47c3a58fc56dde`.
Prior isolated lint/Guard validation therefore still applies, including the raw
Guard failures; this review does not relabel them as passes.

AWS Core now successfully reaches AWS. The verified account is `114599789754`;
the connection reports a root identity. No credentials were fetched or created.

The named stack reads returned:

- `flo-customer-artifacts`: `CREATE_COMPLETE`.
- `flo-customer-staging`: `UPDATE_COMPLETE`.
- `flo-customer-enrollment-state`: `CREATE_COMPLETE`.
- `flo-customer-enrollment`: AWS explicitly returned that the stack does not exist.
  The diagnostic wrapper then hit an unavailable `ClientError` symbol while trying
  to classify that response; the service's recorded error, not that wrapper error,
  is the evidence of absence. Future reads should use gathered per-call errors.

## Existing destination and public surface

Bucket: `flo-customer-artifacts-artifacts-wiyewwqt3d1r`, us-west-2.
Fresh API reads confirm versioning Enabled, default AES256 encryption, all four
public-access blocks enabled, BucketOwnerEnforced ownership, and the existing
HTTPS-only deny policy. The `flo-enrollment/` listing returned no Contents.
This is prefix-specific inventory, not an account-wide storage audit.

The existing API `i4ceh4qpdg` has only its `$default` route. Its `$default` stage
retains rate 2 requests/second, burst 5, and access-log fields limited to request
ID, status and latency. Configuration is verified; this does not prove new log
delivery or fresh customer sign-in. No enrollment route has been added.

Lambda account settings report concurrency 1,000, unreserved 995, and two functions.
The proposed runtime requires three additional reservations of one each. This is
reserved concurrency, not provisioned concurrency; no live limits were changed.

## Next requested action: upload plus review-only CREATE change set

Upload only the three reviewed ZIPs to their content-addressed `flo-enrollment/`
keys, with no public ACL and no overwrite of an existing candidate. Capture real
S3 version IDs and verify content length, encryption and SHA-256 before using
them in CloudFormation. Do not invent version IDs or replace them with `latest`.

Prepare a uniquely named CREATE change set for `flo-customer-enrollment`, us-west-2,
using the unchanged template inline and `CAPABILITY_IAM`. Explicitly set:

```text
EnableEnrollment=false
PublishRoutes=false
EnableApproval=false
ApprovalDesignation=null
```

Use only existing, verified table/API/secret identifiers and the existing public
LWA client ID. The state secret value is not needed for planning and must not be
fetched. Real S3 version IDs and a new release ID complete the parameters after
upload; this document is not an executable parameter file.

Expected plan: 18 additions (three functions, three immutable versions, three
execution roles, six managed policies, three seven-day log groups). The nine
conditional API integration/route/permission resources remain excluded. Verify
the actual change set and `DescribeEvents` before presenting it for execution.
Creating a CREATE change set leaves a `REVIEW_IN_PROGRESS` stack record, but does
not provision its application resources. Do not execute it under this approval.

No operator grants, customer designation, customer links, new databases, new
secrets, VPC, NAT gateway, DLQ, or website changes are in this preparation scope.
Keep the previously approved staging policy direction: default encryption and
scoped no-VPC/no-DLQ exceptions, with raw findings visible. Runtime execution
requires its own review of IAM authority, resource changes and costs.

## Cost of this preparation only

Public Oregon S3 Price List data, retrieved live, gives Standard first-tier
storage at $0.023/GB-month and PUT/COPY/POST/LIST at $0.005 per 1,000 requests.
Script-calculated storage for these three ZIPs alone is approximately
$0.000022816/month; three PUTs cost $0.000015 before free allowances, discounts
or taxes. Additional inspection requests and retained future versions add usage.
This is not an estimate of the whole account, a guarantee of a zero bill, or a
spending cap. No Lambda runtime or Bedrock invocation is included in preparation.

Deployment, if separately approved, adds Lambda invocation/duration, operational
logging and other applicable usage. Existing staging, DynamoDB backup/storage,
secrets and narrator costs continue independently. Present the execution cost
review alongside the actual resulting change set, not as an approval inferred
from the small ZIP-storage estimate.

Pricing source: [Amazon S3 pricing](https://aws.amazon.com/s3/pricing/).
Machine-readable API responses and calculations are in
[review evidence](enrollment-preupload-review-2026-09-06.json).

## Logging verification and release gates

The earlier read-only control simulations returned implicitDeny for stream ARNs
even with unrestricted Allow and explicit Deny controls, while a group-ARN control
returned allowed. That inconsistency is not proof that widening runtime permissions
is needed. Amazon's [logging permission guide](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/iam-identity-based-access-control-cwl.html)
supports stream-scoped CreateLogStream/PutLogEvents permissions. Preserve the exact
scopes; actual role/log-delivery verification is required before routes are enabled.
The simulator's internal cause remains unestablished.

Hosted customer mapping tests, independent operator/MFA authorization, official
Alexa+ checks, replacement demo review and final release approval remain separate.
Devpost submission and video publication stay paused.
