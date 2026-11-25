# Isolated Flo customer staging

Latest recorded customer checkpoint, September 8, 2026: the [staging HTTPS origin](https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com/) had real Login with Amazon enabled, separately approved fictional-customer pairing, and A-only repair reads with B/unknown denial. See [completed pairing](../../../docs/verification/fictional-a-pairing-completed-2026-09-08.md) and [hosted fixture isolation](../../../docs/verification/customer-repair-fixture-live-2026-09-08.md). Signing in alone does not establish repair ownership; no second Amazon account, hosted estimate/schedule or official Alexa+ linking was verified. These are dated observations, not a fresh deployment or sign-in check. The September 5 build/concurrency and initially disabled-login checkpoints below are historical; they are not the current login status.

This is a separate read-only website, not the narrator, staff demo, or official Alexa+ account-linking endpoint. `customer-lambda.ts` handles API Gateway HTTP API payload v2 without starting an HTTP listener. It shares the customer HTTP/MCP implementation with the local preview.

## Build and test before any public exposure

Verification checkpoint: the [September 5 CloudShell Docker report](../../../docs/verification/cloudshell-docker-2026-09-05.md) records a successful Docker image build, six-service demo launch, DynamoDB Local contract test, packaged Lambda smoke, and 92 passing local regression tests. These results do not establish deployed IAM, real Login with Amazon, or official Alexa+ linking.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm build:customer
pnpm typecheck
pnpm lint
pnpm test
docker compose build mcp
docker compose -p flo-customer-test -f docker-compose.customer-test.yml up --abort-on-container-exit --exit-code-from customer-contract
docker compose -p flo-customer-test -f docker-compose.customer-test.yml down --volumes --remove-orphans
```

The dedicated container test uses **DynamoDB Local**, an isolated internal network, fictional identities and explicit dummy credentials. It refuses AWS/remote endpoints and removes only its own randomly named emulator tables. The ordinary unit suite uses clearly labeled atomic-store and SDK-command fakes; those results alone do not prove DynamoDB or live LWA behavior.

Bundle output: `dist/customer-staging/index.mjs` plus `public/` and `package.json`. Zip those contents (not the parent directory), calculate its SHA-256, and use `flo-customer/<sha256>.zip` in a reviewed private, versioned same-region artifact bucket. No artifact bucket is created by this template. Never upload `.env`, customer-link files, `.private`, local credentials or the full working directory.

Deployed package: [verified Linux ZIP](../../../docs/verification/customer-package-2026-09-05.md), SHA-256 `744a3e67d9bc003479cbf95d015b6ac3d696cae7ae687e5b36a7514610a57cc3`, 615,803 bytes, S3 version `3pbmv1gha2sCK7UPUi7bZ_1q8QjtPPTX`. Downloaded bytes matched exactly, and live Lambda CodeSha256 still matches after the concurrency update. See [current verification](../../../docs/verification/customer-concurrency-deployment-2026-09-05.md), including successful parallel and browser checks. The source-manifest, packaging, extracted-bundle smoke and hosted-smoke scripts preserve distinct provenance and test scopes; serial smoke success alone does not establish browser readiness.

On a Windows host that blocks esbuild's child-process launch, invoke the installed vendor `esbuild.exe` directly using the same entrypoint/bundle/platform/node22/ESM/banner options in `scripts/build-customer-staging.mjs`, then run that script with `--assets-only`. This is an explicit workaround, not proof that the normal build command or Docker ran on Windows. The normal command must also pass in Linux/Docker.

## Identity and state boundaries

- Sessions and pending OAuth states use strongly consistent reads and conditional revision writes. Concurrent callbacks can consume login state only once, before the token exchange. No in-memory session fallback exists in the Lambda runtime.
- Opaque session IDs are hashed in database keys. Values are AES-256-GCM encrypted, binding ciphertext to the table/key/revision/expiry. The key is injected through a Secrets Manager dynamic reference, never logged or returned. Rotating this key requires a new auth-state table; existing state must not be silently restored under a replacement key.
- Five-minute login expiry and at-most-15-minute session expiry are checked during authorization. TTL is eventual physical cleanup, not access control. Refresh tokens are not retained.
- An Amazon identity does not prove repair ownership. `CustomerLinks` is a separate table; the website role has **GetItem only**. A record must contain the exact client ID, Amazon subject, customer ID, active flag, verification operator/time and evidence reference. These fields record an operator decision, not an automated ownership-verification service. Never link based on email, caller-provided customer IDs, or the first user to sign in.
- The operator must independently verify the association through a trusted shop process. For staging, use only explicitly approved test identities and fictional repair records. The original customer website role cannot write links. Separate authenticated enrollment request/redemption handlers and private operator approval were subsequently deployed and tested as recorded in the September 8 checkpoint above; they do not grant repair ownership merely for signing in.
- Customer repair projections are queried by the authenticated customer's partition, with ownership and repair-number checks on every returned record. Runtime cannot write these projections. This is not a live synchronization integration with a commercial shop.
- Website sessions never authorize the closed `/alexa/mcp` route. AWS execution credentials, narrator credentials and raw Amazon tokens are not customer sessions.

## Prepare the fictional repair 1842 update

Complete the local shop workflow for repair 1842, including the explicit **Confirm** step for the simulated Bay 2 appointment. Save the JSON response body from that local `POST /api/command` in a temporary file. Keep the confirmation local and use only the seeded fictional shop data.

```sh
node scripts/prepare-staging-repair-1842-update.mjs local-confirm-response.json
```

The offline generator emits a review document with the recorded staging target, the expected row before and after the update, and one DynamoDB `UpdateItem` request. It accepts a successful shop confirmation with matching UTC times on the work order and booked slot. The request sets status and appointment times for `staging-customer-a` / `1842`. It preserves the staging vehicle label and null estimate. The conditional write requires the existing key, owner, original repair map and null estimate to match. The customer portal continues to read the projection under the existing owner checks.

### Live staging checklist

Start once an approved Amazon test account is linked to fictional customer A (`staging-customer-a`).

#### Before the update

- [ ] Sign in to the staging portal. Run `Show my repairs` and confirm it lists only **1842**. Run `Show repair 1842` and confirm it shows `diagnosis` with no appointment. [Staging portal](https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com/)
- [ ] Confirm a fresh fictional Bay 2 appointment in the local shop simulator. Regenerate the review plan from that confirmation and check that the request changes only the status and the two UTC appointment times.
- [ ] Verify the staging account and resolve the current `CustomerRepairs` table from `flo-customer-staging` in `us-west-2`. Verify the active fictional owner link and strongly read the exact **1842** row. Stop if the row differs from `expectedBefore`.

#### Apply and verify

- [ ] After the exact update is approved, have the authorized writer apply the single conditional update. The September fixture approval covered the original inserts. Strongly read the same row and compare it with `expectedAfter`. If the write is rejected or its outcome is uncertain, read the row before retrying.
- [ ] Start a fresh customer A session. Confirm **1842** shows `scheduled` with the exact planned start and end times in **UTC**. Run `Show estimate 1842` and confirm the portal reports that no estimate is ready.
- [ ] If a second authorized, linked test account is available, confirm it sees its own staging repair **2842**. Requests for **1842** and an unknown repair such as **9999** should return the same generic denial with no appointment details. Leave this live check pending if only one account is available.
- [ ] Sign out and confirm the portal clears the repair details and requires sign-in again. Record the reviewed plan and the results without saving credentials or session cookies.

## Proposed infrastructure and review gates

`template.yaml` describes one HTTP API, one Lambda, three on-demand DynamoDB tables with throughput ceilings, one generated state-encryption secret, a narrow role/managed policy, and two seven-day log groups. **Live Lambda reservation is 3**, matching the reviewed and separately approved template. The [concurrency review](../../../docs/verification/customer-concurrency-review-2026-09-05.md) and [execution evidence](../../../docs/verification/customer-concurrency-deployment-2026-09-05.md) record the validation and live verification. It does not invoke Bedrock, expose mock-service ports, grant link/repair writes or alter the narrator.

The generated HTTPS origin and exact callback are outputs. Initially `LwaEnabled=false`; do not enable it until the profile, private secret provisioning, privacy/terms review and test links are ready. LWA secret ID is a reference only; the secret must contain JSON field `clientSecret`. The deployment role resolves it; the public function has no Secrets Manager read API permission. Do not print function environment variables when checking deployment.

Before execution: cfn-lint, Guard policy review, exact change-set/`describe-events` review, applied concurrency quota, artifact verification, and explicit cost/creation approval. The owner separately approved the resource-scoped staging treatments in [policy-exceptions.json](policy-exceptions.json) on September 5; narrator exceptions were not inherited. These accept AWS-managed/default encryption, no auth-state backups, and no VPC/DLQ for this synchronous flow. They require review by October 5 or earlier if the assumptions change, including before production or real customer repair data. Raw Guard findings remain visible. Application encryption protects authentication payloads. API route auth is deliberately public for the landing/OAuth flow; application-session and ownership enforcement protect data routes. Policy approval is not deployment approval.

The [initial pre-execution review](../../../docs/verification/customer-staging-review-2026-09-05.md) records zero-finding cfn-lint, five scoped Guard exceptions, matching template hashes and no AWS pre-deployment validation errors. All 14 initial additions completed after owner approval. The subsequent approved concurrency update also completed. At that September 5 checkpoint, LWA was disabled with empty client/secret-reference parameters, the private artifact bucket contained the verified ZIP, and regional concurrency was 1,000 with 995 unreserved after the customer reservation of 3. Do not treat those historical settings as a fresh readback or change limits without approval. See [the recorded deployment findings](../../../docs/verification/customer-concurrency-deployment-2026-09-05.md) and [artifact policy exceptions](artifact-policy-exceptions.json).

Authentication backups are deliberately disabled: restoring old sessions can undo logout. Link/repair PITR is proposed at seven days; restoration must reconcile revocations, ownership and deletions before the website is re-enabled. Restored authentication state must never be connected to the website. Use a new empty auth table and a new state key; require fresh sign-in.

Running costs include API/Lambda usage, DynamoDB reads/writes/storage/PITR, Secrets Manager, logs, artifact storage and data transfer. The infrastructure review documents individual public-rate components, not a total bill. Throughput caps, throttles and reservations are not a hard spending cap. Retained tables, secrets and logs can remain after stack deletion; do not assume deletion eliminates costs.

## References and release status

- [API Gateway payload-v2 contract](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html)
- [DynamoDB TTL cleanup semantics](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html)
- [DynamoDB conditional PutItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html)
- [Login with Amazon authorization code grant](https://developer.amazon.com/docs/login-with-amazon/authorization-code-grant.html)

The limited-preview privacy/terms assets were hosted and their bytes verified at the September 5 checkpoint. Operator: Alexander Ammann; privacy contact: xyes47314@gmail.com (owner-confirmed monitored inbox). Review/update them as data practices change. Subsequent September 8 records above establish the bounded real sign-in and fictional pairing/isolation checks, while official Alexa+ validation/certification and real customer ownership verification remain separate gates. See the current repository README for later video/Devpost publication evidence; the earlier paused-publication checkpoint is historical.
