# Enrollment AWS preflight — executable change set not ready

## Outcome

Live, read-only AWS checks confirmed the existing customer staging stack and its customer-link read-only boundary. Source-based IAM analysis produced an **unattached, overbroad baseline that must not be deployed**. An independently authenticated human operator also remains unconfigured. No template was changed, no AWS resource or credential was created, and no customer mapping or deployment occurred.

This is a deployment-readiness review, not a claim that new enrollment infrastructure is ready for execution. Earlier application tests remain recorded in [local interface verification](customer-pairing-interface-2026-09-05.md); the full suite was not rerun during this metadata/policy review.

## Fresh live evidence

Scope: account `114599789754`, `us-west-2`, stack `flo-customer-staging` and its referenced customer execution role; account IAM user/role inventory to find an operator. No Lambda environment values, secrets, customer records, sessions, repair records or invitation codes were read.

- STS identified the connected AWS session as `arn:aws:iam::114599789754:root`. This is not an acceptable operator grant in Flo's current private authorizer; no root exception was added.
- Stack: `UPDATE_COMPLETE`; last update `2026-09-06T03:00:49.569000+00:00`; 14 stack resources returned. Drift remains `NOT_CHECKED`, not verified drift-free.
- Website origin: `https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com`; callback `/auth/lwa/callback`.
- API routes: one `$default` route to the existing customer integration, application-level authorization (`AuthorizationType: NONE`). No newly attached enrollment routes were found.
- Stage: auto-deploy enabled; rate 2 requests/second, burst 5; access-log format contains request ID, status and latency, not payload or credentials. Log retention was not refreshed in this turn.
- Customer Lambda reserved concurrency: 3.
- Customer role: `flo-customer-staging-CustomerRole-F3EBVfIp3zcy`; one attached CloudFormation-managed policy; zero inline policies. Existing policy allows auth-state Get/Put/Delete, **only GetItem on customer links**, Get/Query on repair projections, and writes only to its function log group. No attached policy was changed.
- IAM inventory: zero IAM users, eight roles. All eight trust AWS service principals: six service-linked roles and the two Flo Lambda roles. No existing human-assumable operator candidate was found in that inventory. This does not establish whether an external identity provider or other account has a usable human sign-in; those were not inspected.

### Current role policy simulation

`SimulatePrincipalPolicy` against the actual customer-links table returned:

| Action | Decision | Missing context values |
| --- | --- | --- |
| GetItem | allowed | none |
| PutItem | implicitDeny | none |
| UpdateItem | implicitDeny | none |
| DeleteItem | implicitDeny | none |

These are IAM simulator results, not DynamoDB writes or an end-to-end ownership test. They support preserving the current customer-link read-only role; they do not prove all possible account policies or live customer behaviors.

Successful control-plane APIs: STS GetCallerIdentity; CloudFormation DescribeStacks/ListStackResources; IAM GetRole/ListAttachedRolePolicies/ListRolePolicies/ListUsers/ListRoles/GetPolicy/GetPolicyVersion/SimulatePrincipalPolicy; API Gateway V2 GetRoutes/GetStage; Lambda GetFunctionConcurrency. No mutating AWS API was used.

## Source-based IAM analysis

Installed `uv` 0.12.10 into ignored `.private/iam-tools`; IAM Policy Autopilot reported version 0.3.0. The first runner attempt tried an automatically managed Python and failed on its expected Windows target directory; the retry explicitly used the existing bundled Python and succeeded. No project dependency manifest was changed.

Reproducible analysis command (source only; **no `--upload-policies`**):

```powershell
$env:DISABLE_IAM_POLICY_AUTOPILOT_TELEMETRY = 'true'
$env:UV_CACHE_DIR = 'C:\Users\alexa\Documents\Codex\2026-09-03\jo\benchflow\.private\uv-cache'
& 'C:\Users\alexa\Documents\Codex\2026-09-03\jo\benchflow\.private\iam-tools\bin\uvx.exe' --python 'C:\Users\alexa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' iam-policy-autopilot@latest generate-policies `
  'C:\Users\alexa\Documents\Codex\2026-09-03\jo\benchflow\services\flo-mcp\src\customer-enrollment-dynamodb.ts' `
  'C:\Users\alexa\Documents\Codex\2026-09-03\jo\benchflow\services\flo-mcp\src\customer-enrollment-operator.ts' `
  'C:\Users\alexa\Documents\Codex\2026-09-03\jo\benchflow\services\flo-mcp\src\customer-enrollment-private.ts' `
  'C:\Users\alexa\Documents\Codex\2026-09-03\jo\benchflow\services\flo-mcp\src\customer-dynamodb.ts' `
  'C:\Users\alexa\Documents\Codex\2026-09-03\jo\benchflow\services\flo-mcp\src\customer-lambda.ts' `
  --region us-west-2 --account 114599789754 --service-hints dynamodb sts --pretty
```

The first analysis displayed the tool's default telemetry notice; telemetry was explicitly disabled for the subsequent explanation run. This report does not claim that the first run's usage telemetry was disabled. Tool documentation states it does not collect customer content; see [the official project](https://github.com/awslabs/iam-policy-autopilot).

The exact first generated JSON is preserved as [NOT-FOR-DEPLOYMENT baseline](customer-enrollment-autopilot-baseline-NOT-FOR-DEPLOYMENT.json). It grants DynamoDB actions across **all tables in this account/region**, KMS decrypt across all regional keys through DynamoDB, and STS GetCallerIdentity. It merges permissions for different processes. A narrower re-run on the enrollment adapter with `--service-hints dynamodb --explain 'dynamodb:*'` still returned wildcard table/key scopes and included transaction/replication-related action expansion. No generated policy was attached, uploaded, or manually substituted into a template.

### Valid syntax is not least privilege

AWS Access Analyzer `ValidatePolicy` returned zero findings for the generated identity policy. Nevertheless, `SimulateCustomPolicy` returned **allowed** for both PutItem and DeleteItem on `arn:aws:dynamodb:us-west-2:114599789754:table/flo-review-unrelated-synthetic-table`.

That ARN was a counterfactual simulator input, not a created or accessed table. The simulation demonstrates why a zero-finding syntax/policy check is not enough for this deployment. We reject this baseline for attachment.

## Required design work before an executable change set

The current local transaction adapter intentionally combines start, approve and redeem operations. Its absence from the public Lambda preserves today's boundary. Mounting that whole adapter under an execution role with its union of permissions would **not** establish IAM-enforced separation of customer-facing activity and operator approval. Hiding `/enrollment/approve` alone is insufficient for that claim. No exploit of the deployed site was reproduced; this is a pre-deployment architecture gap.

The recommended refinement is:

| Component | Proposed authority | Boundary to prove |
| --- | --- | --- |
| Existing customer-read Lambda | Remains unchanged/read-only for links | Cannot insert, change or remove customer mappings |
| Enrollment-facing handler | Validate the original customer session; start a pending request; invoke a private redemption service | Cannot write operator approvals or directly insert trusted links |
| Private redemption service | Validate independently stored operator approval, the same verified identity/session, expiry and one-time state; atomically consume and create link/audit | No public approval path; cannot accept customer-selected identity/customer IDs |
| Private human operator command | Exact non-root identity plus fictional-A grant; create a separately protected approval snapshot and audit | Customer B and service/root identities remain excluded |
| Request / approval / audit stores | Separate writable pending requests from operator-owned approval evidence; bounded retention | Customer-facing role cannot rewrite approval evidence; restores cannot revive sessions/grants |

This suggests two new narrowly scoped runtime functions plus request, approval and audit storage, rather than treating the earlier one-handler/two-table sketch as finalized. It requires a source/adapter split, regression tests, regenerated per-process policy baselines, and a reviewed non-root operator sign-in. Exact resource counts, storage retention, invocation permissions, cost estimates and rollback behavior are not finalized or approved by this document. Do not fabricate an operator ARN or attach broad permissions to make the template deploy.

AWS recommends temporary federated credentials, MFA and least privilege for human access; see [IAM best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html). A dedicated non-root operator must be configured through a separately approved access-management step. Do not use the account root identity or repurpose either Flo Lambda service role.

After the source boundary and operator identity are resolved: create the scoped template, run cfn-lint and Guard against that exact template with reviewed exceptions, validate/simulate intended allowed and denied permissions, prepare a review-only change set, inspect resource replacements/removals and pre-deployment validation, and present ongoing costs before execution. No new enrollment template exists yet, so this turn did not run its cfn-lint/Guard/change-set checks or claim it passed them.

Submission, video publication, real customer linking and deployment remain paused. No live role, policy, secret, table, function, API route, or customer data was changed by this review.
