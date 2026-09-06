# Flo enrollment deployment preparation

**Draft only. No permission policy, change set or deployment is approved by these files.**

**Current retention revision:** the owner approved a 30-day fictional audit retention target. Audit TTL is now configured and new writes carry exact expiry; seven-day PITR stays enabled. Current SHA-256: `573fe2694bab405740ab93f71c0b912b3c667229ca7f2bbf6e60e9db9d84f775`. The previous validation and exceptions cover only the archived pre-retention hash. See [current implementation and verification](../../../docs/verification/enrollment-audit-retention-2026-09-05.md).

`state.template.json` is a separately reviewable first increment containing exactly three new DynamoDB tables. It does not update the existing customer stack, create functions or roles, attach routes, provision credentials, seed data or link a customer. Local project-invariant tests are not CloudFormation schema/policy validation.

**Latest check:** fresh cfn-lint on the current hash passed with no findings. Guard reported the same two policy failures, retained in [raw evidence](../../../docs/verification/enrollment-retention-validation-2026-09-05.json). Current-hash policy treatment and the runtime/resource plan still require review before execution; see [release preflight](../../../docs/verification/release-preflight-2026-09-05.md). This does not repin the historical exception manifest or claim deployment readiness.

| Resource | Configuration | Recovery treatment |
| --- | --- | --- |
| EnrollmentRequests | Standard on-demand; generated name; string `id` partition key; `ttl` enabled | No PITR; never restore admission/request authority |
| EnrollmentApprovals | Separate protected store; same key shape and TTL | No PITR; never restore consumed/expired invitation authority |
| EnrollmentAudit | Separate evidence store; same key shape; seven-day PITR window | Evidence only; never replay evidence to create links |

Each table has server-side encryption enabled, deletion protection, retain-on-delete/replace, and maximum on-demand throughput of 10 read and 5 write request units per second. There are no secondary indexes, streams, replicas, restore/import sources or resource policies. The template does not add customer-managed KMS keys. These settings are proposed for review, not silently covered by earlier exceptions for different templates.

TTL is asynchronous cleanup, not authorization expiry or guaranteed physical deletion at day 30. Existing code checks request, approval and session expiry at transaction time. Seven-day PITR means a recovery window, **not seven-day record retention**. Audit writes now include a 30-day expiry and TTL. The shared evidence filter excludes expired/legacy/malformed records and never renews timestamps on recovery. Deletion protection and retained resources also mean stack deletion is not a cleanup procedure; retained storage can keep accruing charges.

## Existing resources — read-only refresh

Checked at `2026-09-06T05:05:06Z` (September 5 local Pacific time), account `114599789754`, region `us-west-2`:

- `flo-customer-staging`: `UPDATE_COMPLETE`, 14 resources, drift `NOT_CHECKED`.
- Website origin: `https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com`.
- Auth table: `flo-customer-staging-AuthState-17UXOCYCV0R2C`.
- Links table: `flo-customer-staging-CustomerLinks-RL0X18FE6W9W`.
- Repair projections: `flo-customer-staging-CustomerRepairs-1TU01CXBBGKYE`.
- Operator: `arn:aws:iam::114599789754:user/flo/flo-staging-operator`, immutable ID `AIDARVLVOAS5N5MWSFYR5`; one MFA device, no attached/inline policies or group memberships.
- Lambda quota: 1,000 account concurrency; 995 unreserved at this check. This is capacity, not authorization or a spending cap.
- Connector identity: account root. It was used only for read-only metadata/pricing checks, never operator approval. The password CSV and secret values were not read.

The inventory and pricing evidence are in [read-only preflight results](../../../docs/verification/enrollment-deployment-preflight-2026-09-05.json). This is not an account-wide IAM audit or a drift scan.

## Runtime permission plan — still unresolved

The existing customer-read role must remain unchanged. New runtime roles must have distinct authority:

| Principal | Required capability | Must be rejected |
| --- | --- | --- |
| Request handler | Read verified encrypted sessions; check absence of links; start requests; invoke one exact published redemption version | Approval writes; direct link writes; repair reads; arbitrary function invocation |
| Redemption handler | Read/recheck original session and protected approval; consume pending request and insert absent link/audit atomically | Creating/editing approval evidence; request creation; repair reads |
| Approval authority | Check pending request/session/unlinked status; write approval snapshot and audit for designated fictional A | Link insertion; changing requests; selecting customer B; bypassing MFA |

These are review requirements, **not generated or attached IAM policies**. AWS IAM Policy Autopilot 0.3.0 was rerun with the new SDK invocation path. It still generated wildcard table/key/function scopes and an overly broad DynamoDB action union. Its complete command and unchanged result are retained in the [NOT-FOR-DEPLOYMENT baseline](../../../docs/verification/enrollment-handler-autopilot-NOT-FOR-DEPLOYMENT.json); no generated baseline is acceptable merely because generation succeeded. The IAM skill requires this source-analysis workflow and does not permit substituting an invented source-derived policy.

### Operator scope must not depend on an editable grant file

The prior local CLI verified STS account/ARN/immutable identity and an editable allowlist. That implementation has now been replaced with exact-version private Lambda invocation only. The new approval artifact receives its fixed customer, identity hash and evidence reference from deployment-controlled configuration. [Implementation and verification](../../../docs/verification/enrollment-private-authority-2026-09-05.md) remain local. A user with direct approval-table write permissions could still bypass any CLI or handler, so no such permission may be granted to the operator. MFA alone does not enforce customer scope.

Before granting live invocation permissions, review and deploy the separately controlled private approval service with a real independently verified fictional-A designation the operator cannot edit. The additional private function is implemented locally but has no deployment template, IAM grants or live configuration yet. Do not add an HTTP approval route or fabricate independently verified designation evidence. The storage-only template remains unchanged.

For MFA, choose one complete, testable path: enforce MFA at role assumption and limit the role session, or use MFA-authenticated `GetSessionToken` credentials with appropriate operation-level checks. Do not assume `GetCallerIdentity`, `AWS_SESSION_TOKEN`, console success or a client-supplied field proves MFA. [AWS distinguishes these temporary-credential flows](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_configure-api-require.html). No temporary credential issuance or permission attachment occurred here.

## Cost review

The read-only AWS Price List lookup for Oregon returned these standard on-demand rates (USD; before credits/taxes/discounts):

- Read request unit: `0.000000125`.
- Write request unit: `0.000000625`.
- Standard table storage beyond applicable free allowance: `0.25` per GB-month.
- PITR: `0.20` per GB-month of protected table data.

Request units are not application HTTP requests; transactional operations and larger items consume additional units. No free-tier eligibility is assumed. This storage-only template adds no Lambda execution, API route, customer-managed KMS key, VPC, NAT gateway or DLQ. Existing services continue to have their own costs. A full enrollment deployment would additionally incur function, API, logging and artifact-storage usage and must be priced separately.

The throughput settings constrain request rates but are **not a hard dollar cap**. Storage and retained resources remain billable. Do not execute a stack based solely on a small illustrative workload estimate. Verify current rates again at deployment review; [AWS on-demand pricing](https://aws.amazon.com/dynamodb/pricing/on-demand/) is the public pricing reference.

## Validation and next review

1. Local check: `node scripts/check-enrollment-state-plan.mjs`. This checks only deliberate project invariants and produces a content hash; it does not run cfn-lint/Guard.
2. Previous CloudShell validation found no lint findings and two failing/two passing Guard policies on the old hash. It is historical evidence only; rerun schema/policy validation for the retention revision before deployment review.
3. Earlier encryption/PITR exceptions remain pinned to the old hash. `node scripts/check-enrollment-policy-exceptions.mjs --historical` verifies only the archived snapshot; the default command deliberately rejects the changed template. CI checks historical integrity and stale-evidence rejection, not current deployment readiness. Raw findings remain visible. No exception automatically covers the new hash.
4. Resolve approval authority and final IAM restrictions before preparing any runtime change set. Then review exact resource additions/replacements, actual parameters, finite logs, secret injection and ongoing cost before execution.
5. Only after separately approved deployment, test allowed and rejected AWS operations as each real principal, followed by hosted sign-in/pairing/customer isolation tests.

Submission and video publication stay paused. Do not describe this draft as a finished deployment plan, a green CloudFormation validation, deployed IAM separation or Alexa+ account linking.
