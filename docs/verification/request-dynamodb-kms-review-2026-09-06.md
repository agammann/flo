# Request runtime DynamoDB KMS correction — review ready

**Subsequent execution:** the user approved this exact plan; it was deployed and
one hosted request succeeded. See [deployment evidence](request-dynamodb-kms-deployment-2026-09-06.md).
The unexecuted statements below preserve the earlier review checkpoint.

September 6, 2026 UTC. **Implemented and validated; not executed.**

## Failure and narrowly scoped correction

The previous authenticated request returned HTTP 503. CloudTrail identified an
explicit permissions-boundary denial of `kms:Decrypt` for the request execution
role. The boundary admitted Lambda environment decryption only; its global
Lambda-function-context denial also blocked the distinct DynamoDB service leg.
The denied event omitted request parameters, so it did not prove an exact table
or key by itself. This review separately verified DescribeTable metadata for
AuthState, CustomerLinks and EnrollmentRequests: all three are ACTIVE, encryption
is ENABLED, and all use the same existing DynamoDB key recorded in the JSON evidence.

The correction separates key-scoped environment and database branches. Database
decryption requires the exact existing key, correct account, regional DynamoDB
ViaService, subscriber ID and one of the three exact table names. Independent
explicit denials reject each absent or wrong condition. It grants no additional
DynamoDB actions, no repair reads, no approval writes and no link writes. Identity
baselines remain untouched; a boundary is a ceiling, not a standalone grant.

Official references: [DynamoDB encryption usage notes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/encryption.usagenotes.html)
and [KMS ViaService conditions](https://docs.aws.amazon.com/kms/latest/developerguide/conditions-kms.html#conditions-kms-via-service).
These describe separate service-mediated key use; the successful policy simulations
below do not substitute for actual request execution.

## Exact review artifacts and results

- [Full proposed resolved boundary](request-dynamodb-kms-boundary-REVIEW-ONLY.json):
  6,110 non-whitespace policy characters; IAM limit 6,144. The generator rejects
  oversized resolved configurations. Longer future resource names require review.
- [Exact update template](request-dynamodb-kms-update-2026-09-06.template.json):
  file SHA-256 `fcb5a2bacbffbf897663060e193708edc95a266efd79601fb680c714f84b834e`.
  Submitted as compact JSON, 32,295 bytes, within the inline TemplateBody limit.
  Do not submit the larger pretty-printed file directly.
- Source generator and resolved review-policy parity passed. Resolving the exact
  change-set boundary with the reviewed parameters also matches the simulated
  policy, including its unchanged pinned redemption version.
- Full workspace build, typecheck and lint passed. Application suite: 151 total,
  148 passed, three platform skips, zero failed. Infrastructure-script suite:
  56 passed, zero failed. Skips are not passes.
- AWS Access Analyzer: zero findings. Existing Autopilot identity baseline plus
  proposed boundary: 64/64 cases passed. Independent broad-Allow simulation
  fixture plus boundary: 65/65 passed. The broad fixture was never attached.
  Only the positive environment-decrypt case is excluded from the baseline suite:
  that fixture does not model Lambda's existing key-policy/grant authorization.
- cfn-lint 1.52.1: zero findings on the exact update. Guard 3.2.1: raw FAIL,
  three failing policies / 12 properties, 19 passing policies and 12 skipped.
  All 33 selected rule-file hashes match pinned revision
  `7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`.
- Guard failure signatures are exactly the existing log-key-management, no-DLQ
  and no-VPC findings across the three existing functions/log groups. Preserve
  the previously approved narrow staging treatments, not a blanket compliance
  claim. No new failure, key, queue or networking resource is introduced.
- Local Docker validation used the existing isolated image, no network, a
  read-only filesystem/mount and no AWS credentials. No fresh Compose launch is
  claimed for this permissions-only change.

## AWS change set — not executed

Stack: `flo-customer-enrollment`, us-west-2, account `114599789754`.

Change set: `flo-request-dynamodb-kms-review-20260906T193507Z`.

ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-request-dynamodb-kms-review-20260906T193507Z/a269342f-8300-4b84-864d-dd9da456039a`.

At review AWS reported CREATE_COMPLETE / AVAILABLE, with exactly one Modify:
`RequestBoundary`, AWS::IAM::ManagedPolicy, Replacement=False. No Add or Remove
actions; no changes to other resources, published versions, routes, identity
baselines, keys, tables, logs, concurrency or secrets. Existing parameters use
UsePreviousValue; only RequestDynamoKeyArn is added. Approval and redemption
remain false, enrollment remains true and ReleaseId is unchanged.

The retrieved change-set template equals the reviewed template. DescribeEvents
reports successful CREATE_CHANGESET and no VALIDATION_ERROR events: no reported
property/name-conflict failures; no bucket deletion applies. This is pre-deploy
validation, not proof of runtime success. Connector STS reports account root;
its administrative planning calls are not evidence of operator authorization.

## Execution boundary and cost

Separate approval is required to execute this named change set and verify live
policy/settings. It adds no billable resources or new recurring key-storage
charge. Existing API, Lambda, DynamoDB, logging and applicable KMS usage remain
billable; restoring a working request path can increase successful usage. No hard
dollar cap is claimed. No customer request was made, read or linked in this review.

After deployment, run one bounded signed-in/unlinked request test and inspect
sanitized status/error evidence. A pending request is not shop verification or
repair ownership. Private approval/redemption still need their own database KMS
review and controlled tests before enablement. Do not relax their gates as part
of this request-only correction. No invitation, designation or mapping is created.

Source push, fresh GitHub Actions, official Alexa+ checks, replacement video and
Devpost release remain separate unfinished gates; publication stays paused.

See [machine-readable validation and AWS evidence](request-dynamodb-kms-review-2026-09-06.json).
