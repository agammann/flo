# Customer pairing interface and private operator command — local verification

## Completed in this increment

- Separate pairing HTML/JavaScript, served only through the opt-in enrollment HTTP wrapper. Pending state retains Sign out, accepts no chosen customer/Amazon identity, and claims no repair access. Requests and redemption require explicit consent.
- After redemption the page rechecks the server's customer session before showing a verified link. It handles rejection, expiry, malformed replies, logout failure and late responses. Codes are cleared on pagehide, hidden visibility and logout; no browser storage, URL code transport or console logging.
- Private Linux/CloudShell-oriented approval command using the existing STS identity grant and DynamoDB approval transaction. POSIX file ownership/mode checks, symlink rejection, strict inputs, exclusive owner-only output reserved before mutation, and generic terminal status without private values. Windows fails closed rather than relying on ineffective POSIX ACL assumptions.
- Operator workflow and proposed separation documented in [customer-pairing-operator.md](../architecture/customer-pairing-operator.md). No executable CloudFormation change set or live cost quote was prepared.
- Regression checks explicitly verify pairing routes stay unmounted in the normal Lambda: 404 with configured LWA, and fail-closed 503 when LWA is disabled before dispatch.

## Final checks actually run

| Check | Result |
| --- | --- |
| Build | All 13 TypeScript workspace configurations passed |
| Typecheck | All 13 configurations passed |
| Whole-repository ESLint | Passed, zero warnings |
| Windows full regression suite | 129 tests / 21 suites: 126 passed, 0 failed, 3 POSIX-only skips |
| Linux Docker full regression suite | 129 tests / 21 suites: 128 passed, 0 failed, 1 Windows-only skip |
| Fresh Docker image build | Frozen-lockfile install, workspace build and customer Lambda bundle build passed |
| DynamoDB Local Compose contracts | Encrypted session persistence and complete enrollment transaction contracts passed |
| Packaged Lambda smoke test | Five public assets returned 200; disabled auth, separate Alexa route and malformed transport failed closed |
| Git whitespace check | No diff whitespace errors; existing Windows LF/CRLF warnings only |

All 129 tests passed on their applicable platform across the Windows and Linux runs. The eight new UI tests execute the actual browser JavaScript with a controlled DOM/fetch harness; **they are not visual browser/device tests or a real hosted Amazon sign-in test**. Three new POSIX file tests ran inside Docker; their private approval callback is simulated. Existing STS contract tests also use controlled SDK responses, not live IAM credentials.

The Linux full suite used `flo-demo:local` with `--network none`, `NODE_ENV=test`, and read-only mounts of the nonsecret infra directory, Dockerfile, Compose file and `.env.example` needed by source-policy tests. Runtime source and compiled tests came from the freshly built image. Manifest-list digest: `sha256:d6b95b66b9427a7f9e81e6565169f9263459e0a4603e1bd6ba13fee0d478f9fc`.

The customer bundle smoke used production image defaults, no credentials and no network, with synthetic `AWS_REGION`, API ID, repair table name and HTTPS origin settings, and `LWA_ENABLED=false`. Those nonsecret configuration values are required even though no database/provider call occurs.

The database contract run used the official DynamoDB Local 3.3.1 image pinned in `docker-compose.customer-test.yml`, on an internal Docker network, with explicit dummy credentials and synthetic identities. It verified concurrent single-use redemption, replay rejection, persistence across auth instances, MCP customer A reads/B isolation, audit-collision rollback, logout at commit, expiry before TTL cleanup, revoked links, concurrent starts/approvals, and the shared admission ceiling. No live AWS API was contacted.

## Corrections caught while testing

1. My initial new route assertion expected 404 from a fixture with LWA disabled. The service correctly returned 503 before routing. The test now covers both configured (404) and disabled (503) cases; no production authorization logic was weakened to satisfy it.
2. The first isolated bundle smoke invocation omitted its required region and repair-table configuration, so initialization correctly failed closed. Supplying nonsecret fixture settings made the unchanged bundle pass. No credentials or secrets were supplied.

Afterwards, only the temporary Compose project `flo-pairing-verify-20260905` containers and network were removed. Its database was in-memory synthetic test data; the source and reusable local image were retained.

## What has not changed / next gate

No hosted site, real customer mapping, IAM role, table, AWS template, secret, GitHub repository, submission, or video publication was changed. No fresh GitHub Actions run or live AWS status refresh occurred. The normal Lambda still does not import/mount enrollment; its packaging does not include pairing assets or the operator command. Local CSS contains scoped pairing-input styles only.

Next is the exact deployment review for a separate enrollment handler/control plane, request/audit tables, reviewed retention/recovery behavior, least-privilege roles, operator identity/grants, rate controls and ongoing costs. Do not give the current customer-read Lambda general link-write or operator-approval permissions. After approval, hosted tests must independently prove the real Amazon account is linked only to approved fictional customer A and that customer B/service credentials remain blocked.

This local pairing increment is not proof of real repair ownership, live operator authorization, hosted enrollment, official Alexa+ account linking or certification. Submission and video publication stay paused pending separate final approval.
