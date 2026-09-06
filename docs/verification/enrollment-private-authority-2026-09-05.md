# Private enrollment approval authority — local deployment preparation

## Outcome and scope

The editable-grant/direct-database path has been removed from the private operator CLI. The new locally built approval function has a deployment-controlled customer/identity designation and its own approval-only adapter. **Deployment verification remains blocked on actual IAM/MFA enforcement and independently verified live test designation.** This is not a completed AWS authorization fix, hosted enrollment, production repair-ownership verification or Alexa+ account linking.

No AWS resources, IAM permissions, secrets, live mappings or customer routes changed. No GitHub push or Actions run occurred. Submission and video publication remain paused. The already validated storage template and its policy exceptions are unchanged.

## Source-to-sink correction

Previously, operator-owned configuration supplied grants and table names, while the request supplied a customer ID/evidence reference. The CLI constructed the database writer directly. Private file permissions protected confidentiality but could not stop the file owner changing customer authority. A broad database grant would also bypass the CLI entirely.

Now:

- `customer-enrollment-private.ts` accepts routing configuration only: purpose, account, region and functionArn. It constructs a Lambda client, not DynamoDB/STS clients. Old tables/grants/customer/evidence inputs fail strict parsing. Owner-only files, exclusive output reservation, no overwrite, generic errors and no automatic retry remain intact.
- `customer-enrollment-approval-invoke.ts` accepts requestCode and explicit confirmation only. It invokes one same-account/same-region numeric published version, synchronously, without log tail, with bounded response/timeout and strict output validation.
- `customer-enrollment-approval-lambda.ts` receives customerId, identityKey, authorityId, evidenceRef and admission expiresAt from independently controlled deployment configuration. No default live designation is seeded. The handler rejects caller customer/identity/evidence/MFA overrides. A designation is not evidence merely because it parses.
- `DynamoDesignatedEnrollmentApprover` checks the fixed identity before writes. Existing conditions bind the identical request identity/proof at transaction commit; protected approval and audit writes remain atomic. No customer link is created by approval.
- Three separately built artifacts preserve dependency boundaries. Request/redemption exclude approval code; approval excludes start/redeem adapters, invocation adapter and customer identity runtime. The new approval function does not need the LWA secret or the auth-state encryption key.

The fixed authorityId is configured-authority attribution, not proof of the invoker's identity. Direct SDK invocation/context does not authenticate an operator to application code. AWS [Lambda context](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html) describes function/invocation information, not a general authenticated operator identity. Follow the separately enforced [MFA API access flow](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_configure-api-require.html), not a payload flag or STS lookup inside Lambda.

Designation expiresAt is an admission deadline. It does not revoke previously committed approvals: the original request/session deadline still controls redemption. Audit-record retention remains a distinct unresolved decision; seven-day PITR is not record expiry.

## Verification

Independent read-only investigation confirmed the old path and compatibility requirements. A separate candidate review found no source-level customer/identity override bypass under the stated invoke-only IAM assumption; it correctly identified stale CLI documentation, which was updated. Neither review is evidence of live AWS enforcement.

| Check | Result |
| --- | --- |
| Workspace build | All 13 configurations passed |
| Workspace typecheck | All 13 configurations passed |
| Repository ESLint | Exit 0, zero warnings |
| Windows suite | 147 tests / 25 suites; 144 passed, 3 POSIX-only skips, 0 failures |
| Linux Docker suite | 147 tests / 25 suites; 146 passed, 1 Windows-only skip, 0 failures |
| New focused cases | Fixed designation, invalid overrides, expiry, disabled/missing config, redacted failures, exact-version invocation, uncertain results, identity-to-transaction binding |
| Actual DynamoDB Local Compose | Passed: wrong identity creates no approval; customer override denied; correct approval and original-session redemption succeed; existing race/isolation/replay/logout contracts pass |
| Packaged artifacts, network disabled | Approval + request/redemption smoke tests passed with synthetic configuration only |

Reproduction commands from repository root:

```text
node scripts/compile-workspaces.mjs
node scripts/compile-workspaces.mjs --noEmit
node node_modules/eslint/bin/eslint.js . --max-warnings=0
node scripts/run-tests.mjs
docker build -t flo-approval-review:local .
docker run --rm --network none flo-approval-review:local node scripts/smoke-enrollment-approval-bundle.mjs /app/dist/customer-enrollment/approval/index.mjs
docker run --rm --network none flo-approval-review:local node scripts/smoke-enrollment-bundles.mjs /app/dist/customer-enrollment/request/index.mjs /app/dist/customer-enrollment/redemption/index.mjs
```

Use NODE_ENV=test for the full test suite. For Linux full-suite execution, mount only the nonsecret narrator infra directory, Dockerfile, docker-compose.yml and .env.example read-only at corresponding /app paths (as earlier test reports document). Never mount .env, credentials, .private or the operator CSV. For database contracts set FLO_CUSTOMER_TEST_IMAGE=flo-approval-review:local and run `docker compose -p flo-approval-review -f docker-compose.customer-test.yml up --abort-on-container-exit --exit-code-from customer-contract`.

Final tested image manifest-list digest: `sha256:96920d00d9847f1a6600caaa121721e1502872d62ba87e2b032998fd2552f31f`. The two temporary Compose containers and their internal network were removed after verification; their database was synthetic/in-memory. Reusable images and source remain. The existing flo-demo image was not overwritten.

## IAM preparation and exact remaining gates

The IAM skill requires deterministic source analysis, so the installed Autopilot 0.3.0 was verified and run with telemetry disabled and no upload flag. The complete generation command is recorded with its unchanged output in [the rejected baseline](enrollment-approval-invoker-autopilot-NOT-FOR-DEPLOYMENT.json). It now identifies invocation only, but still grants every Lambda function in the account. That is **not** the required exact-version permission and includes no MFA enforcement. Nothing was attached; a hand-invented source policy was not substituted.

Before enabling this code:

1. Review a real independent assignment of the owner's verified Amazon test identity to fictional customer A, with evidence reference and finite admission window. Do not infer ownership from email/login or create a link directly.
2. Resolve the final IAM policy artifact and validate it: operator may invoke only the approved numeric function version through the chosen programmatic MFA path. Deny non-MFA, expired credentials, other functions/versions, service/customer principals, direct table writes, writer-role assumption and code/configuration/policy changes. The operator must not control the designation or its deployment.
3. Review runtime permissions per function and all resource policies/event sources. No public approval URL/route, async event source or broadened customer-read role. Exact invocation IAM—not locally editable ARN validation—is the real AWS boundary.
4. Settle audit-record retention, prepare the full runtime CloudFormation plan, validate it and review its exact resources and ongoing costs before execution approval. The approved three-table template alone does not deploy these functions or permissions. Existing exceptions do not automatically extend to new resources.
5. Run live allowed/rejected AWS calls and hosted original-session pairing/customer isolation, then the separate official Alexa+ checks. Only after release reconciliation and separate confirmation may submission/video publication proceed.

No new live AWS metadata, policy simulation, cost estimate or change set is claimed in this increment.
