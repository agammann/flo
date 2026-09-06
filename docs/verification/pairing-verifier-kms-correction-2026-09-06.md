# KMS correction: local implementation and AWS simulation review

**Review only. No live IAM changes, decryption calls, customer reads, approvals,
links, publication, or submission were made in this increment.**

The complete proposed boundary is in
[the review-only policy](pairing-verifier-kms-boundary-REVIEW-ONLY.json).
The companion JSON records the full generator output, statement labels, and
two complete 57-case simulation suites. Its 20:00Z deadline is a simulation
fixture, not an approved live permission window. Regenerate the deadline for a
fresh, separately approved window of at most 30 minutes before applying.

## Exact permission change

The old boundary explicitly denied kms:Decrypt, including DynamoDB's downstream
table-key decrypt. The correction adds only that KMS action to the ceiling,
with the following restrictions enforced by explicit Deny statements:

- Exact existing key:
  arn:aws:kms:us-west-2:114599789754:key/dd2b8d6c-5d80-4461-b4fe-a4780bc9b2a4.
- ViaService must be dynamodb.us-west-2.amazonaws.com; direct KMS calls fail.
- CallerAccount and encryption-context subscriberId must be 114599789754.
- Encryption-context tableName must be the exact EnrollmentRequests table.
- The existing exact-principal, region, and expiry checks also cover KMS.
- Missing or wrong scalar context values are denied independently. They must
  not be combined into a single multi-key StringNotEquals condition (AND).

No Encrypt, GenerateDataKey, CreateGrant, key-administration, replication read,
customer write, secret retrieval, role assumption, or Lambda invocation is added.
The underlying Autopilot baseline already contains Decrypt and is unchanged.
No key policy, DynamoDB configuration, encryption choice, or resource is changed.

## Existing protections retained

The 900-second fresh-MFA rule remains on each DynamoDB GetItem. KMS is only a
service-mediated dependency, not a new standalone user sign-in/ownership path.
All existing missing/false/negative/stale MFA denials remain. Six explicit
non-proof attributes, mandatory projection, exact table, and 64-character
partition-key shape checks remain. No Scan, Query, mutation, approval, or
invocation is allowed. The CloudShell identity grant is unchanged.

KMS protection is table-level, not field-level. DynamoDB authorization controls
which fields are returned. IAM still permits six-field reads for known
64-character request keys, not only one hard-coded request; the interactive
verifier limits the approved test to its synthetic probes and the one supplied
request. Neither an identity fingerprint nor this verifier proves repair ownership.

To fit IAM's 6144-character limit, redundant principal/region/time/MFA checks
were removed from the ceiling's Allow statements, not from its explicit Denies.
The compact ceiling is 5509 characters. Resource ceilings, optional CLI login
scope, and explicit VPC restrictions remain. Every statement's descriptive label
is retained in the companion review JSON, outside the size-limited policy.

## Evidence and regression results

- AWS Access Analyzer: zero findings for boundary and unchanged CloudShell grant.
- Reviewed identity policies + boundary: **57/57** expected decisions.
- Simulation-only broad-Allow fixture + boundary: **57/57** expected decisions.
  The broad fixture was never attached or created as an IAM policy.
- Tests include allowed projected read, service-mediated decrypt, direct/wrong
  service decrypt, wrong/missing context, other keys/tables/principals/regions,
  expired/missing time, MFA failures, proof access, missing projection, all
  attributes, key shape, forbidden service actions, and CloudShell restrictions.
- Local boundary/fixture tests: **10 passed**.
- Full local policy-script regression suite: **51 passed**, no skips or failures
  (includes those 10 boundary/fixture tests).
- Isolated Linux Docker private-verifier tests: **13 passed**, no skips.
- Application build and typecheck passed across 13 TypeScript projects.
- Application regressions: **148 passed, 3 skipped, 0 failed**.
- Lint passed after correcting a globalThis qualification in the new fixture.

The initial fixture incorrectly used DynamoDB ARNs for four non-DynamoDB
actions, yielding implicit instead of explicit denials. Fixed the ARN types,
added a fixture regression, and reran both full suites. A combined rerun exceeded
the connector's 100-call limit; final evidence comes from two successful bounded
57-call runs. No application resources were touched by these simulations.

Final IAM metadata reads confirmed the operator still has only
SignInLocalDevelopmentAccess, with no inline policies, groups, or boundary.

## Source and live-verification limits

AWS's [service reference](https://servicereference.us-east-1.amazonaws.com/v1/kms/kms.json)
confirms Decrypt, the key ARN shape, and scalar condition-key types.
[DynamoDB encryption context](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/encryption.usagenotes.html#encryption.context)
documents aws:dynamodb:tableName and aws:dynamodb:subscriberId.
The denied CloudTrail event had no requestParameters, so earlier false context
comparisons meant absent evidence, not proof of a different context format.

DynamoDB caches table keys; KMS checks do not necessarily occur on every read.
The finite window and fresh-MFA gate therefore remain independently enforced
on DynamoDB reads. See the same AWS encryption usage notes.

Simulations validate supplied contexts, not actual service execution or a real
customer link. A fresh, bounded operator test is still required after approval.
Use boundary-first attachment, confirm exact readback, verify source hash, run
at most three synthetic probes, and request private input only after all pass.
Stop on any failure. Remove identity grants first, verify absence, then remove
the boundary and its temporary managed policy. No approval/linking is included.

No new key or paid infrastructure is proposed. Existing DynamoDB/KMS request
usage can still be billed; this policy is not a dollar-spending cap.
