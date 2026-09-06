# Temporary private-request verifier access: review only

## Decision requested

Do not attach yet. The owner authorized preparation, not a new IAM grant.
The browser is signed in as flo/flo-staging-operator but CloudShell cannot create
its environment. Live IAM readback showed only SignInLocalDevelopmentAccess,
no groups, inline grants or boundary. Repeated sign-in cannot add permissions.

Prepare a 30-minute access window for the existing exact IAM user
`arn:aws:iam::114599789754:user/flo/flo-staging-operator`. The archived policy uses
18:45 UTC on September 6 only as a simulation deadline, not an approved live
window. Regenerate with a deadline 30 minutes after approved attachment begins,
rerun expiration/allow/deny cases against those exact bytes, and record the time.

No customer link, invitation, approval function, public route, table, KMS key,
VPC, administrator grant, password or access key is proposed.

## Exact permission layers

1. Keep the existing sign-in managed policy. Generate the verifier identity
   baseline with AWS IAM Policy Autopilot (command below); preserve its raw output
   for provenance, **never attach it without the verified boundary in place**.
2. Reference-derived CloudShell grant: CreateEnvironment, DescribeEnvironments,
   CreateSession, GetEnvironmentStatus, StartEnvironment, PutCredentials and
   GetFileUploadUrls only. Creation/list need Resource `*`; supported environment
   operations are scoped to account 114599789754 and us-west-2 environment ARNs.
   Expiration, exact principal and requested region apply. VPC-related context
   on environment creation is denied. No environment deletion/download grant.
3. Maximum-permission boundary: only GetItem against the exact EnrollmentRequests
   table; six permitted fields (id, identityKey, purpose, expiresAt, status, ttl),
   a mandatory projection, 64-character key shape, and fresh MFA age 0–900 seconds.
   Other table reads, writes, scans, queries, batch reads, Lambda invocation,
   Secrets Manager, KMS decryption, replication reads, IAM changes and role
   assumption are explicitly denied. Preserve exact local CLI sign-in and STS
   identity checking. Both CloudShell and data permissions expire at the deadline.

The generated baseline included wildcard tables, replication read and KMS
decryption. These excess capabilities are explicitly denied by the ceiling.
The baseline is not safe as a standalone grant. The boundary grants nothing by
itself. The complete grant, boundary and descriptive statement labels are in
[the review artifact](pairing-verifier-access-review-2026-09-06.json).

### Limits that must not be overstated

- This is NOT exact-item IAM binding: any known 64-character key in the one table
  can request the six fields within the window. It does not allow enumerating
  keys. The private verifier uses one hash from the owner's code; the one-read
  limit is a test/procedure limit, not an IAM request counter.
- IAM does not inspect the returned row's pending status or expiry. The verifier
  validates those. No scope is gained merely by possessing a hash or observing
  an identity fingerprint; independent fictional-A assignment remains separate.
- CloudShell is a general-purpose terminal with outbound connectivity, not a
  sandbox that forces execution of only this verifier. Its AWS permissions are
  constrained by IAM. GetFileDownloadUrls being denied does not prevent every
  possible outbound file transfer.
- Environment scope is this account/region's environment ARN pattern, not a
  pre-known single environment ID. No EC2/VPC permissions are included.
- Actual CloudShell MFA context and DynamoDB attribute enforcement require
  controlled live tests. Never weaken the MFA or projection gate to make a test
  pass; stop and review the credential path if it fails.

## Source-derived baseline command

```text
uvx iam-policy-autopilot@latest generate-policies C:/Users/alexa/Documents/Codex/2026-09-03/jo/benchflow/scripts/verify-private-pairing-request.py --region us-west-2 --account 114599789754 --service-hints dynamodb sts --pretty
```

Ran Autopilot 0.3.0 using uv 0.12.10 in a disposable local container. Only source
was mounted read-only, no AWS credentials were passed, and network was used for
tool downloads. The tool printed its default usage-telemetry notice. Subsequent
runs should set DISABLE_IAM_POLICY_AUTOPILOT_TELEMETRY=true. No --upload-policies
flag was used. [Raw generated baseline](pairing-verifier-autopilot-NOT-FOR-ATTACHMENT.json).

CloudShell operations and the boundary's DynamoDB conditions were verified
against the [CloudShell service reference](https://servicereference.us-east-1.amazonaws.com/v1/cloudshell/cloudshell.json),
[DynamoDB service reference](https://servicereference.us-east-1.amazonaws.com/v1/dynamodb/dynamodb.json),
and [attribute-access guidance](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/specifying-conditions.html).

## Validation

- 26 AWS SimulateCustomPolicy cases passed. Positive cases include projected
  fresh-MFA reads and non-VPC CloudShell startup/session/upload. Negative cases
  cover missing/proof/session attributes, all-attribute reads, malformed keys,
  MFA absent/false/stale/invalid, wrong principal/region/table, expiration,
  KMS/replication, writes/enumeration, privilege changes, invocation and VPC.
- Six local generator/limit regression tests passed; modified-file ESLint passed.
- The first labeled boundary exceeded the managed-policy 6,144-character limit.
  Removed only optional statement IDs and retained labels outside the policy.
  Final boundary is 5,798 characters. The permission statements are unchanged;
  simulations ran before label removal. Access Analyzer validated the final
  CloudShell grant and label-free boundary with zero findings each.
- No policy is attached; no real caller-context or data read is claimed.

## Safe execution and cleanup order after explicit approval

Proposed exact temporary names: managed boundary
`FloTemporaryPairingVerifierBoundary20260906`, and user inline grants
`FloTemporaryPairingVerifierBaseline` and `FloTemporaryPairingCloudShell`.
The two compact inline documents total 1,544 characters, below the 2,048-character
user aggregate limit when no other inline policies exist (must recheck live).
Stop on any name collision; do not overwrite an existing policy.

Proposed live test budget: at most three read-only probes using one freshly
generated synthetic key (projected read, missing projection, forbidden proof
projection), followed by the previously approved one real request's exact
projected GetItem. No table Scan or Query, no mutation probes, no real customer
fixture reads. IAM metadata/readback and simulations are separate from this
four-read data budget. This is a proposed execution scope, not an attachment
approval or proof that the live tests have passed.

1. Recheck the exact user, policies/groups/boundary, immutable user ID and absence
   of any pre-existing review policy names. Preserve unrelated resources.
2. Review a fresh 30-minute deadline and validate/simulate the final documents.
3. Create a named temporary managed boundary and attach it **first**. Read back
   its full document and exact user attachment before adding either grant.
4. Only then add the generated verifier grant and time-limited CloudShell grant.
   Check aggregate inline policy size or use separately reviewed managed grants;
   do not upload a too-large inline policy or request a quota increase silently.
5. Verify effective permissions and actual non-root CloudShell identity before
   any customer request. Upload only the tested nonsecret verifier source.
6. Test denied paths first using a synthetic nonexistent key, not an unrelated
   customer's row. Bound the live check count in the execution approval. Keep
   the already-approved single real pairing request separate; no auto retries.
7. Run the hidden-input handoff only when ready, leaving approval/redemption off.
8. Remove both temporary identity grants first and verify absence. Only then
   remove the temporary boundary attachment and its newly created policy. Restore
   sign-in-only access. Never remove the boundary while the broad baseline remains.
   An interrupted cleanup must leave the restrictive boundary attached.

This operation needs an authorized administrative AWS connection to change IAM;
the actual verifier must run as the operator, not root. Do not ask the owner to
run the verifier under root to avoid setting permissions.

No application infrastructure charges are introduced by these policy documents;
actual terminal/API/database/logging/network usage is not a hard spending cap.
No cleanup of customer records, AWS application resources or retained versions
is authorized by this plan. Submission and video publication remain paused.
