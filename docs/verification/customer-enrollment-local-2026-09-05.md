# Local customer pairing implementation — September 5, 2026

> Subsequent progress: the durable DynamoDB adapter and private-process STS authorizer are implemented; actual DynamoDB Local transaction and Docker Compose tests passed. A live operator grant/control plane and hosted deployment are still pending. See [durable verification](customer-enrollment-durable-2026-09-05.md). Local-only adapter limitations below describe this earlier checkpoint.

## Authorization and scope

The owner explicitly designated the Amazon account used in the hosted test as the intended account for fictional staging customer A, with customer B inaccessible. This authorizes a synthetic-data test designation only, not ownership of real repair records. **No actual Amazon subject was collected or mapped, and no AWS or hosted state changed in this increment.**

## Working local increment

- `CustomerEnrollment` starts a five-minute request from an authenticated website session. Browser input cannot choose an Amazon identity or customer record.
- `DurableCustomerWebsiteAuth.enrollmentIdentity` revalidates the provider identity and session without granting a repair principal. Its returned proof is server-internal and is not returned by the HTTP wrapper. Existing principal checks still require a trusted link and reread session state after link lookup.
- A separately supplied operator-authorization adapter must approve the specific fictional customer. Customer credentials and role headers do not authorize approval. There is no customer HTTP operator-approval route.
- The request and single-use invitation have independent random 256-bit values; storage uses their hashes. Approval cannot extend the request beyond its original lifetime or the session lifetime.
- Redemption requires the original identity and session revision. Invitation theft by a different account or even a new session of the same account fails. Logout invalidates the original session and requires a new pairing request.
- The transaction contract requires atomic invitation consumption, absent-link creation and audit append, conditioned on live session revision/expiry. Existing inactive links also block enrollment so re-enrollment cannot silently undo revocation.
- The local HTTP wrapper exposes request/redeem only when explicitly constructed by a test. It enforces canonical HTTPS origin, POST, JSON, consent, strict schemas, bounded request body, no-store responses, and duplicate-cookie rejection.

## Important limitations

`LocalEnrollmentStore` is an explicitly named single-process test adapter. It is **not durable, not a DynamoDB transaction implementation, and not mounted by the production Lambda**. It uses synchronous critical sections to exercise the transaction contract. The test operator credential and provider are synthetic fixtures; they do not establish production operator authentication or real Amazon enrollment.

The two fictional repair fixtures reside in the test, not AWS. They exercise existing customer MCP tools using the real MCP SDK HTTP transport through the in-process HTTP handler. The tests do not establish successful live database writes, IAM behavior or hosted cross-customer isolation.

## Verification on final source

- `node scripts/compile-workspaces.mjs`: pass, all 13 workspace configurations.
- `node scripts/compile-workspaces.mjs --noEmit`: pass.
- `node node_modules/eslint/bin/eslint.js . --max-warnings=0`: pass. Two initial lint issues (type-only import and bound test method) were fixed before the final run.
- `node scripts/run-tests.mjs`: **113 tests, 18 suites, all passed**, no skipped tests.
- `node --test services/flo-mcp/dist/customer-enrollment.test.js`: **12 pairing tests passed**.
- `node scripts/build-customer-staging.mjs`: local bundle rebuilt, not uploaded or deployed.
- Docker Node 22.23.2, network disabled, read-only bundle/scripts mounts: `smoke-customer-lwa-config.mjs` passed with synthetic configuration. No provider or AWS calls.
- Bundle inspection found none of the local enrollment route strings or the local store class; production does not mount the new enrollment handler.

Pairing tests cover successful operator-approved A access over MCP; B/unknown repair denial; private operator authorization and scoped grant; invitation theft and session replacement; eight-way concurrent redemption with exactly one success; replay; expiry; inactive-link conflict; logout between identity validation and transaction; provider revocation; expired credentials; input identity/customer overrides; wrong purpose; bad consent; wrong origin; duplicate cookies; service credentials; oversized bodies; one active request per identity; failed storage; post-pairing logout; repeated/expired approval; method/content-type/origin configuration boundaries.

## Next implementation gate

Implement the durable transaction adapter and independently authenticated operator control plane, then test against a database emulator before proposing hosted changes. The database transaction must condition on session revision and expiry, invitation state and purpose, and absent link, and must write the link with the existing verified metadata schema plus audit evidence atomically. Review least-privileged permissions separately; do not grant the existing customer-read role general link-write authority.

Keep invitation codes out of URLs, logs and durable plaintext audit. A real enrollment surface must provide a trusted operator/customer exchange and adequate distributed admission/rate controls. The local one-request-per-identity and 500-pending-request cap are not a complete production abuse control.

The approved real account can be paired only after that flow is implemented, tested, reviewed and deployed. No one should type or extract an Amazon subject to bypass it. Official Alexa+ service/user account linking remains separate. Submission and video publication remain paused.
