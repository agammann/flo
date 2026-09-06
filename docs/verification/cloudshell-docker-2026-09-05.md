# Flo Docker verification in AWS CloudShell — September 5, 2026

## Outcome and scope

The Docker build, actual six-service Compose launch, complete HTTP/MCP demo, DynamoDB Local integration test, and packaged customer Lambda smoke test passed in the existing us-west-2 CloudShell environment. This closes the previously unverified Docker launch gap **for this source snapshot in CloudShell**, not for the restricted Windows Codex session.

No customer staging deployment, CloudFormation update, real LWA login, official Alexa+ linking, GitHub push, Devpost submission, or video publication was performed. No AWS credentials were passed into the test containers. The shop workflow used fictional data; the database contract used DynamoDB Local with explicit dummy credentials on an internal Docker network, not the managed DynamoDB service.

## Reproducible source and artifacts

- Uploaded source archive SHA-256: `58a402465e0abe213f735d6ad9c4a51a71de9c5efe17d8024015c3e3969b5989`.
- All 106 regular files extracted from that archive matched the current local files byte-for-byte when checked in this run. The archive contains the runtime/build/test sources and Compose configuration, not the later customer infrastructure draft, documentation, or GitHub workflow. This is not a claim that the entire dirty repository was archived or deployed.
- Tested `flo-demo:local` image ID: `sha256:9a87c62d699681dc5cff25bb867ebcdfb66689b8884c7fa7738d7578f7728e3c`.
- Packaged `dist/customer-staging/index.mjs` SHA-256: `ef6c024657c3ec809cbc6a5c2cd2f8f2865c48203a1e1e6594085d4670062dec`.
- DynamoDB Local reported version `3.3.1`; pulled image digest: `amazon/dynamodb-local@sha256:ff89bd48ff32cd8d9be5fee8873b65b8854dc408f1afe881be6eb00247bc0dab`. The Compose source still uses `latest`; this digest records what was actually tested, not a source pin.
- Standalone Docker Compose `v5.5.1`, downloaded from Docker's official release and checked against its published SHA-256 (`db1889184726840f75c4f9c001048430d4f25b3be3cb084d3ddd762bc0aed576`).

## Executed checks

| Check | Actual result |
| --- | --- |
| Compose configuration | Passed |
| `docker compose build` equivalent using standalone Compose | Failed initially: installed Buildx below required 0.17.0 |
| `DOCKER_BUILDKIT=0 docker build -t flo-demo:local .` | Passed, exit 0; same repository Dockerfile |
| Dockerfile `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm build:customer` | Completed successfully as build steps |
| `./docker-compose -p flo-customer-validation up --no-build -d` | All six services started: shop, inventory, supplier, customer, MCP, simulator |
| `node scripts/docker-smoke.mjs` from CloudShell | Passed against running containers |
| Dedicated customer-contract Compose run | Application test container exited 0; DynamoDB Local was then intentionally stopped by Compose |
| Bundled Lambda import and payload-v2 calls inside the built image | Landing, privacy, and terms returned 200; unconfigured sign-in session returned 503; operator and contact text present |
| Local current-source build / typecheck / ESLint | Passed |
| Local current-source full regression suite | 92 tests, 16 suites, 92 passed, 0 failed/cancelled/skipped/todo |
| Local `git diff --check` | Passed; Git emitted line-ending conversion warnings, not diff errors |

The Docker smoke test exercised real MCP calls for work order 1842, diagnosis, parts search, corrected gross-profit ranking, estimate/approval, a new conversation resolving the Ford, confirmed purchasing/scheduling, customer-only repair/estimate projection, and duplicate-confirmation rejection. It is a fictional repair demo, not a real supplier purchase or customer notification.

The DynamoDB Local test exercised encrypted records, conditional-write callback competition (one provider exchange), session reads across two auth instances, unlinked-account denial followed by an explicit fixture link, customer-partition isolation, and application-enforced expiry while expired records still existed. It also completed a logout deletion after expiry. Active-session logout and in-flight revocation/reassignment rejection are covered separately by the simulated-provider regression suite; the emulator test alone does not establish all those races.

The packaged Lambda smoke test used disabled LWA and inert table names. It verifies the built entrypoint, bundled dependencies, static asset paths, and fail-closed behavior, not AWS API Gateway integration, IAM enforcement, managed storage, real OAuth, or an HTTPS browser session.

## Commands used in the isolated CloudShell source directory

```sh
./docker-compose -p flo-customer-validation config --quiet
DOCKER_BUILDKIT=0 docker build -t flo-demo:local .
./docker-compose -p flo-customer-validation up --no-build -d
node scripts/docker-smoke.mjs
./docker-compose -p flo-customer-local-test -f docker-compose.customer-test.yml up --abort-on-container-exit --exit-code-from customer-contract
```

Cleanup completed for only these two disposable Compose projects: eight test containers and both Docker networks were removed, with successful Compose read-back. Their fictional in-memory state was discarded and can be recreated from the demo seed and test fixture. Source archive, build logs, and images are retained for repeat testing; no broad Docker prune or live AWS resource cleanup was performed.

## Remaining release gates

Review and validate exact CloudFormation changes and ongoing costs before executing the separately approved staging setup. Configure real Login with Amazon and a trusted, operator-verified customer enrollment process, then run successful and rejected hosted flows. A sign-in alone must not create a repair-ownership link. Complete applicable official Alexa+ authorization/tooling checks separately. Push only reviewed source and verify fresh CI. Submission and video publication remain paused for separate final approval.
