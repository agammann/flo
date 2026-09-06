# Separate enrollment Lambda handlers — local verification

## Delivered, not deployed

The request and private-redemption services now have independently bundled Node.js 22 Lambda entrypoints. They are disabled unless `FLO_ENROLLMENT_ENABLED=true`. The existing customer-site Lambda, its routes and its live role were not changed. No real customer mapping was created. This milestone follows the [authority separation work](enrollment-authority-separation-2026-09-05.md); it does not establish deployed IAM isolation or official Alexa+ account linking.

- `customer-enrollment-request-lambda.ts` serves only the pairing page/script and request/redemption HTTP routes. It creates pending requests, never operator approvals or direct customer links. Redemption uses a synchronous SDK invocation of the separately configured private Lambda.
- `customer-enrollment-redeem-lambda.ts` has no HTTP route. It independently validates the original customer session and executes the protected-approval transaction. It cannot create or update operator approval evidence.
- `customer-enrollment-session.ts` reads the existing encrypted, app/origin-scoped website session, revalidates its Amazon subject and rereads revision/expiry after that lookup. It cannot exchange authorization codes, create sessions or mint links. Neither new handler requires the LWA client secret. The existing website remains responsible for verified app-audience code exchange.
- The private invocation envelope accepts only a version, operation, opaque website session and strict request/invitation/consent body. It does not accept a customer ID, Amazon identity, operator designation or asserted service principal.
- The SDK bridge requires an exact same-account/region published numeric Lambda version. It rejects unqualified functions, aliases, cross-account targets, asynchronous status, function errors and malformed/oversized results. Both client timeouts and single-attempt SDK settings are explicit. An uncertain transaction is not automatically retried.
- `build:enrollment` bundles each entrypoint separately. Metafile checks reject the private operator/approval adapter and combined transaction facade in either artifact, the link-writing adapter in the public artifact, and the request-start adapter in the private artifact.

The private operation/version marker is not service authentication. IAM must independently restrict invocation. A synchronous Lambda invocation can return HTTP 200 while reporting a function error; the bridge checks both. See [AWS Invoke API](https://docs.aws.amazon.com/lambda/latest/api/API_Invoke.html). The public transport uses [HTTP API payload format 2.0](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html), validates API identity/stage, ignores asserted Authorization/forwarded identity headers, rejects duplicate cookies and enforces same-origin consent-bearing mutations.

## Verification results

| Check | Result |
| --- | --- |
| Workspace build and typecheck | All 13 configurations passed |
| Whole-repository lint | Passed, zero warnings |
| Windows full suite | 141 tests / 23 suites: 138 passed, 0 failed, 3 POSIX-only skips |
| Linux Docker full suite | 141 tests / 23 suites: 140 passed, 0 failed, 1 Windows-only skip |
| Frozen Docker build | Install, workspace build, customer bundle and both enrollment bundles passed |
| Enrollment packaged smoke, network disabled | Assets loaded; disabled, missing-session and malformed private invocations failed closed |
| Existing customer packaged smoke, network disabled | Home/privacy/terms/scripts/styles loaded; disabled login, Alexa route and malformed transport failed closed |
| Actual Docker Compose / DynamoDB Local | Encrypted persistence and both enrollment handler/transaction flows passed |
| CI configuration and Git whitespace | YAML parsed; new build/smoke steps present; `git diff --check` passed |

All 141 tests pass on their applicable platform across the two full runs. The six new handler tests exercise successful fictional-A linkage and customer-B isolation, service/missing credentials, expired/revoked/logged-out sessions, logout during lookup, request transport and identity spoofing, consent, duplicate cookies, response/error handling and bounded provider lookup. Provider responses and Lambda SDK transport are simulated in those tests.

The separate DynamoDB Local 3.3.1 run executes real conditional writes and transactions with synthetic identities. It additionally exercises the public/private handler factories over encrypted sessions, immutable protected approvals, request/approval tampering, eight-way redemption races, replay, cross-instance persistence, expiry before TTL deletion, audit rollback and logout at commit. Its private invocation is in-process: this is database and handler evidence, not AWS IAM or hosted provider evidence.

Runtime image: `flo-enrollment-handlers:local`. Tested manifest-list digest: `sha256:3b8b8ed25807c613c37ca34b17f2d4865ebb289ca1d663ebc1017fd1648204ad`. Prior image tags were not overwritten. CI workflow and documentation were updated after this runtime-image build; no application code changed afterward. The workflow now explicitly builds enrollment artifacts and runs their isolated packaged smoke in the Docker job. No remote run was triggered or claimed.

The frozen install reported the existing ESLint 9.39.5 deprecation warning. This increment did not upgrade that dependency and is not a dependency vulnerability audit.

After verification, only the two exited `flo-enrollment-handlers` test containers and their internal network were removed. Their database was synthetic and in memory; test tables were also cleaned up by the harness. Source and reusable images were retained. No live AWS state was removed.

## Build and reproduce

From the repository root, with pnpm and Docker available:

```powershell
pnpm build
pnpm build:customer
pnpm build:enrollment
pnpm typecheck
pnpm lint
pnpm test
docker build -t flo-enrollment-handlers:local .
docker run --rm --network none flo-enrollment-handlers:local node scripts/smoke-enrollment-bundles.mjs /app/dist/customer-enrollment/request/index.mjs /app/dist/customer-enrollment/redemption/index.mjs
$env:FLO_CUSTOMER_TEST_IMAGE = 'flo-enrollment-handlers:local'
docker compose -p flo-enrollment-handlers -f docker-compose.customer-test.yml up --abort-on-container-exit --exit-code-from customer-contract
```

The Linux full suite uses `--network none -e NODE_ENV=test`, with read-only mounts into `/app` of the nonsecret `infra/aws/bedrock-narrator`, `Dockerfile`, `docker-compose.yml` and `.env.example` test fixtures; run `node --test-reporter=spec scripts/run-tests.mjs`. Never mount `.env`, `.private`, credentials or the operator CSV. The runtime Docker image remains production mode; explicit test mode is only for regression fixtures.

Artifacts are `dist/customer-enrollment/request/index.mjs` with its `public/` assets and `dist/customer-enrollment/redemption/index.mjs`. They are local bundles, not uploaded ZIPs or an executed CloudFormation deployment. Pairing's `/signin.css`, session/sign-out endpoints and repair views still belong to the existing customer service and require same-origin route coordination.

## Configuration contract — deployment must be reviewed

Both handlers require these exact settings, supplied by a reviewed deployment, not committed credentials:

| Setting | Meaning |
| --- | --- |
| `FLO_ENROLLMENT_ENABLED` | Defaults disabled; only literal `true` opts in |
| `AWS_REGION`, `FLO_AWS_ACCOUNT_ID` | Reviewed same-account/region scope |
| `LWA_CLIENT_ID`, `FLO_CUSTOMER_PUBLIC_ORIGIN` | Same app and canonical HTTPS origin as the existing website |
| `FLO_CUSTOMER_STATE_KEY` | Existing auth-state encryption key, privately injected; never log, commit or paste it |
| `FLO_CUSTOMER_AUTH_TABLE` | Existing encrypted website-session store; intended read/condition-check authority only |
| `FLO_ENROLLMENT_REQUESTS_TABLE` | Pending requests, identity guard and admission counter |
| `FLO_ENROLLMENT_APPROVALS_TABLE` | Separately protected immutable operator approvals |
| `FLO_CUSTOMER_LINKS_TABLE` | Trusted subject-to-fictional-customer links |
| `FLO_ENROLLMENT_AUDIT_TABLE` | Minimal approval/redemption evidence without bearer codes |

The five table names must be distinct. The request handler additionally requires `FLO_CUSTOMER_API_ID` and `FLO_REDEMPTION_FUNCTION_ARN` (exact published numeric version). `LWA_CLIENT_SECRET` is deliberately not read by either handler. Existing encrypted sessions contain sensitive provider credentials; granting their read/decrypt capability requires review and does not permit copying their contents into tools, logs or reports.

## Remaining release gates

1. Constrain distinct runtime roles and the actual non-root operator's programmatic execution. Console MFA success does not prove MFA enforcement for an SDK approval. Reject the earlier broad generated IAM baselines; test permitted and denied operations against final exact policies. The public role must not write approvals/links; redemption must not write approvals; the operator must not insert links or designate customer B.
2. Prepare and validate CloudFormation resources, same-origin route integrations, private invocation permissions, secret injection, concurrency/rate controls, seven-day payload-free logs and recovery handling. Do not enable function payload logging/tracing: the private envelope contains session and invitation credentials. Review exact changes and ongoing costs before execution.
3. Deploy only after the separate approval, then run bounded real hosted success/rejection tests with an independently designated fictional customer A. A website sign-in or request code alone is not repair ownership evidence. Keep all real repairs inaccessible until their separate verification exists.
4. Complete the applicable official Alexa+ tooling, service/user authorization and route-review checks. Reconcile release materials and record/review the replacement demo. Submission and video publication remain paused pending separate final approval.

No AWS resource, policy, permission, customer link, hosted route, secret, GitHub remote, Devpost submission or video publication was changed in this increment.
