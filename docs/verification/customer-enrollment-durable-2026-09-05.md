# Durable enrollment implementation and database verification

Subsequent local increment: the opt-in customer pairing page and private operator command are now implemented; see [operator workflow and deployment boundary](../architecture/customer-pairing-operator.md). The verification results below are the earlier adapter increment, not a new live deployment.

## Scope

Implemented the DynamoDB transaction adapter and a private-process STS operator authorizer. The owner-approved target remains fictional customer A; customer B must remain inaccessible. **No AWS API calls, live operator configuration, customer mappings, new hosted routes, IAM changes, deployment, GitHub push, submission, or video publication occurred in this increment.** Package installation and Docker registry downloads used the network; database tests used only DynamoDB Local and explicit dummy credentials.

## Durable transaction adapter

`DynamoEnrollmentTransactions` uses the existing encrypted auth-state and verified-link schemas plus distinct request and audit tables. Each operation uses DynamoDB transactions, following the [official TransactWriteItems contract](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html): actions address distinct items and commit together.

- Start: condition-check session revision/expiry and absence of a link; create the hashed request, claim a per-identity active-request guard, and increment a shared fixed five-minute admission counter in one transaction. Ceiling: 500 successful starts per fixed window. Expiry of guard records is enforced in conditions, not by waiting for TTL cleanup.
- Approve: strongly read and validate the request; condition-check the session and absent link; update only a pending request with matching revision; append operator-approval audit atomically.
- Redeem: validate purpose, invitation hash, original identity/session, revision and expiry; atomically condition-check the session, consume the invitation, create the absent verified link and append link-created audit. The link stores verified operator/time/evidence metadata. Existing inactive links remain conflicts.
- Concurrent request/approval/redemption conflicts fail closed. Audit collisions roll back link creation and invitation consumption. Capacity, permission, malformed-data and unknown service failures are not treated as completed transactions.
- SDK retries within an invocation use one random client request token. Cross-request replay is blocked by stored state and absent-link conditions, not only the SDK's temporary idempotency window. An uncertain response must be investigated; do not overwrite a link to retry.
- Request records contain server-verified identity/proof metadata but no access token or plaintext request/invitation bearer value. They require private access and appropriate retention/encryption. Audit excludes bearer codes and raw sessions.

## Private operator authorization

`createStsOperatorAuthorizer` calls STS GetCallerIdentity using the separately configured private process's credentials. It requires an exact account, IAM user/role ARN and immutable principal ID in an operator-maintained grant, then returns only that grant's customer allowlist. Roles without paths and IAM users are supported; unsupported identities fail closed. Root, unlisted service roles, different/recreated roles, inconsistent session identifiers, wildcard grants and pasted customer/service credentials are rejected.

[GetCallerIdentity identifies the caller; it does not establish authorization](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html). Therefore successful STS calls alone do not grant enrollment privileges. Tests stubbed SDK responses; **no live STS operator test was run**.

This authorizer must remain in a private operator process/control plane. It must NEVER be installed as a public customer's authorizer: STS would identify the process's service role, not the incoming website user. The production Lambda does not mount it. No real allowlist or dedicated operator identity has yet been selected, configured or granted write access.

## Tests actually run

- Build: all 13 TypeScript workspace configurations passed.
- Typecheck and whole-repository lint passed.
- Full regression suite: **116 tests, 19 suites, all passed**, no skipped tests. Includes three new STS contract tests and the existing twelve local pairing tests.
- Direct Node-to-DynamoDB-Local enrollment test passed.
- Fresh `docker compose build mcp`: Linux dependency installation with frozen lockfile, all workspace builds and customer Lambda bundle build passed.
- Updated Docker Compose customer contract path passed: existing encrypted auth/session database tests followed by new enrollment database tests. Both containers used an isolated internal Docker network without AWS connectivity.

Emulator: official `amazon/dynamodb-local` digest `sha256:ff89bd48ff32cd8d9be5fee8873b65b8854dc408f1afe881be6eb00247bc0dab`; runtime reported version 3.3.1. Built app image `flo-demo:local` manifest-list digest `sha256:69231b8b1abc50166e67786f1ae698208abab9b6d57e5f5fe3023c3439685470`. These are local Docker results, not a fresh GitHub Actions run.

The actual emulator tests verified:

1. Eight concurrent redemptions produce exactly one success; replay and another identity fail.
2. A new auth instance reads the persisted verified link.
3. Customer A's fictional repair is read through the existing HTTP/MCP flow; B and unknown repair responses are equally denied.
4. An injected audit collision leaves neither a new link nor a consumed invitation; retry after removing only that test collision succeeds.
5. Session deletion after identity verification blocks the transaction at commit.
6. Expired invitations are rejected while their TTL rows still exist.
7. Link revocation and logout block access; an inactive link cannot be restored by enrollment.
8. Concurrent starts and approvals admit exactly one winner.
9. A full shared admission window rejects another start.
10. Audit output contains no raw session, request code or invitation.

The first emulator invocation caught an overly broad constructor table-name check: the fixture also carried a repair table. The adapter now validates its four specific table names, preserving their distinctness; the actual database tests and lint were rerun successfully.

Both test runners delete only their own randomly named tables. The temporary Compose project `flo-enrollment-verify-20260905` and standalone emulator container were stopped/removed afterward. All discarded data was synthetic, in-memory test data. The reusable built image was retained.

## Repeat locally / CI

```powershell
node scripts/compile-workspaces.mjs
docker compose build mcp
docker compose -p flo-customer-test -f docker-compose.customer-test.yml up --abort-on-container-exit --exit-code-from customer-contract
docker compose -p flo-customer-test -f docker-compose.customer-test.yml down
```

The existing GitHub Actions Docker job already invokes this Compose file. Its command now runs `scripts/run-customer-database-contracts.mjs`, which executes both contracts sequentially. This CI configuration has not been pushed or run remotely in this increment.

## Remaining hosted gate

Select and verify a narrowly authorized operator identity; assemble its private control plane and customer request/redeem UI; review table retention and recovery rules, request metadata access, distributed abuse controls, distinct least-privilege roles and exact AWS changes. Do not add general link-write permission to the current customer-read Lambda as a shortcut. Restoring old invitation/auth state must not revive grants or sessions; keep pairing state disposable and reconcile link revocations before restored data can serve traffic.

Then run hosted success/rejection tests using the approved real Amazon test account and fictional repairs. Database-emulator success is not proof of deployed IAM, a real operator grant, hosted enrollment, or official Alexa+ linking. Submission and video publication remain paused.
