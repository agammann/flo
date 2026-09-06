# Enrollment authority separation — local implementation verified

## Delivered

- Split the durable adapter into `customer-enrollment-dynamodb-start.ts`, `customer-enrollment-dynamodb-approve.ts`, and `customer-enrollment-dynamodb-redeem.ts`, with shared validation/transaction helpers. The combined facade is explicitly local-contract-only.
- Added an approval-only domain service and changed the private CLI to instantiate only the approval adapter. It does not construct the combined customer enrollment service or link-creation adapter.
- Required a fifth, distinct `approvals` table in private configuration. Old four-table configuration fails validation. No live table or config was changed.
- Approval atomically checks the original session and unlinked identity, verifies the complete pending request, and inserts a protected immutable approval snapshot plus audit. It does not modify the pending request or create a customer link.
- Redemption reads authority only from the separate approval store. Inline request approvals are never a fallback. It rechecks the complete snapshot and request/session/identity/expiry at commit, then atomically consumes the request, creates an absent link and appends audit. It cannot overwrite a revoked link and does not update approval evidence.
- Added six SDK-command/domain tests and extended real DynamoDB Local contracts for forgery, request tampering, replacement sessions, immutable approval evidence and an approval change between read and commit.
- Made the Compose contract image selectable with `FLO_CUSTOMER_TEST_IMAGE`, retaining the prior `flo-demo:local` default.

This is tested source and database-transaction separation, **not deployed IAM isolation**. TypeScript visibility and class selection do not establish a security boundary against a process with broad credentials. The existing public Lambda and packaged customer routes remain unchanged/unmounted for enrollment. No auto-migration of old inline approval records exists; they fail closed and must expire.

## Final verification

| Check | Result |
| --- | --- |
| Workspace build | All 13 configurations passed |
| Typecheck | All 13 configurations passed |
| Whole-repository ESLint | Exit 0, zero warnings |
| Windows full suite | 135 tests / 22 suites; 132 passed, zero failures, 3 POSIX-only skips |
| Linux Docker full suite | 135 tests / 22 suites; 134 passed, zero failures, 1 Windows-only skip |
| Fresh Docker image | Frozen install, workspace build and customer bundle build passed |
| Actual DynamoDB Local Compose contracts | Passed, including protected-approval and transaction-race additions |
| Packaged Lambda smoke | Five public assets 200; disabled login, Alexa route and malformed transport fail closed |
| Git whitespace check | Exit 0; existing LF/CRLF warnings only |

All 135 tests pass on their applicable platform across the two full-suite runs. The SDK contract fixture captures intended commands; it does not execute IAM policies or DynamoDB conditions. The separate emulator run executes real database conditions/transactions, with explicit dummy credentials, synthetic identities and no AWS service calls.

Final image: `flo-enrollment-review:local`, manifest-list digest `sha256:4ad00c63e19750aa07cce8f0d8837bc75f785ecf6c97df1de660c64f9e912249`. The previous `flo-demo:local` tag was not overwritten. Runtime source and compiled tests came from this new image.

The final database run proved:

- Forging an approved status/customer B designation inside the request table does not create a link without a protected approval snapshot.
- Changing request identity, session revision, expiry or adding inline approval after legitimate approval blocks redemption.
- A replacement session for the same Amazon identity cannot redeem the original session's invitation.
- Successful redemption leaves the protected approval snapshot byte-for-byte unchanged.
- A privileged test writer changing the protected approval after read but before commit causes atomic rejection, without consuming the request or creating a link.
- Eight concurrent redemption attempts yield exactly one success; replay fails.
- Customer A access/B isolation, encrypted cross-instance session persistence, logout at commit, expiry before TTL deletion, revocation, audit-collision rollback, concurrent starts/approvals and admission limits still pass.

The interleaving test deliberately uses test-only privileged writes against the emulator. It is not a claim that the customer-facing deployment can write the protected store. Snapshot and request checks occur inside the same all-or-nothing transaction; see [official DynamoDB transaction behavior](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html).

## Test invocation corrections

The initial Linux full-suite invocation omitted nonsecret source files required by policy/config tests. With those read-only mounts, it then exposed a missing `NODE_ENV=test` setting: production correctly rejected simulated customer approvals. The final run supplies test mode; production defaults were not weakened. The initial bundle smoke invocation omitted required fixture settings and its bundle argument. The final invocation supplies only nonsecret fixture values, not credentials. All final runs above passed after these harness corrections.

Lint also rejected untyped DynamoDB fixture fields in the new tampering test. The fixture now parses the stored row with its Zod schema before mutation.

Reproduction from the repo root (Docker available on PATH):

```powershell
node scripts/compile-workspaces.mjs
node scripts/compile-workspaces.mjs --noEmit
node node_modules/eslint/bin/eslint.js . --max-warnings=0
node scripts/run-tests.mjs
docker build -t flo-enrollment-review:local .
$env:FLO_CUSTOMER_TEST_IMAGE = 'flo-enrollment-review:local'
docker compose -p flo-enrollment-review -f docker-compose.customer-test.yml up --abort-on-container-exit --exit-code-from customer-contract
```

For the Linux full suite, use `--network none -e NODE_ENV=test` and read-only mounts into `/app` of `infra/aws/bedrock-narrator`, `Dockerfile`, `docker-compose.yml` and `.env.example`, then `node --test-reporter=spec scripts/run-tests.mjs`. Do not mount `.env`, `.private`, credentials, or the credentials CSV.

The production-mode bundle smoke runs with `--network none`, `LWA_ENABLED=false`, `AWS_REGION=us-west-2`, `FLO_CUSTOMER_API_ID=package-test`, `FLO_CUSTOMER_PUBLIC_ORIGIN=https://flo.example`, and `FLO_CUSTOMER_REPAIRS_TABLE=synthetic-repairs`, executing `node scripts/smoke-customer-bundle.mjs /app/dist/customer-staging/index.mjs`. No AWS/LWA credentials are provided.

Only the two temporary `flo-enrollment-review` Compose containers and its internal network were removed after verification. Their data was synthetic and in memory; test modules also delete their own uniquely named tables. Source and reusable images were retained.

## IAM preparation — generated baselines rejected, not attached

Following the IAM skill's source-policy workflow, verified the already-installed IAM Policy Autopilot 0.3.0 and ran separate starter/approver/redeemer source analyses with telemetry explicitly disabled, account `114599789754`, region `us-west-2` and DynamoDB/STS service hints. No upload flag, AWS mutation or credential file was used.

Complete executable commands and unmodified generated outputs are retained in [NOT-FOR-DEPLOYMENT analysis](enrollment-separated-autopilot-NOT-FOR-DEPLOYMENT.json). These are analysis artifacts, not approved policy documents. Each still grants wildcard table/key scopes; the generated transaction action union remains broader than the component's actual operations. None was attached. No new live IAM simulation, Access Analyzer run or CloudFormation change set is claimed for this increment.

## Remaining deployment work

1. Finish deployable request/redemption entrypoints and independently authenticated operator execution. The console MFA sign-in is separately verified; MFA enforcement for actual programmatic approvals is not.
2. Scope runtime permissions to exact resources and required per-component operations, including denial of customer-facing approval writes and direct link creation. Enforce fictional-customer A scope independently of a locally editable grant file. Run allowed/denied policy checks against the final policies; reject these broad generated baselines.
3. Create and validate the exact resource plan, retention/recovery policies and costs before requesting change-set execution. Requests, protected approvals and audit storage plus separate runtime components are still proposed, not deployed.
4. Test real hosted enrollment with the original Amazon session, independently verified fictional A designation, customer B isolation and service-credential denial.

No AWS resource, role, policy, customer link, hosted site, secret, GitHub remote, Devpost submission or video publication changed. No new GitHub Actions run was triggered. The signed-in operator and existing customer site were not altered by this local implementation. Submission and video publication remain paused.
