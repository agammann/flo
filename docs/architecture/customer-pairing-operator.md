# Customer pairing and the private test-operator workflow

## Status and authority boundary

Latest live checkpoint: the [request-only deployment](../verification/enrollment-request-only-deployment-2026-09-06.md)
is complete. Request version 3 is enabled and the three request-stage routes
are attached. Redemption version 3 and private approval version 3 remain disabled.
All 12 credential-free hosted checks passed; this did not link a customer.

Latest authentication checkpoint: [fresh-MFA live operator testing](../verification/operator-fresh-mfa-test-2026-09-06.md)
verified exact-version authorization and one disabled version-2 invocation,
returning `ok=false`, `status=503`. Two out-of-scope DryRuns were rejected.
The temporary invocation grant and boundary were removed after testing; only the
sign-in managed policy remains attached. This establishes the actual credential
path, not an enabled customer designation, approval transaction, or ownership link.

As of the September 6 request-only deployment, `/pairing`, `/pairing.js` and
`/enrollment/request` route to the separate request function, not the existing
customer Lambda. No `/enrollment/redeem` or public operator-approval route is
attached. Only request contains pairing assets; only approval contains the
approval adapter. No enabled operator grant or live test designation has been
established. Do not enable approval/redemption or broaden the customer-read role
as an incidental step. Earlier version-2 startup and CloudWatch system-log
evidence remains in [logging verification](../verification/enrollment-system-logs-deployment-2026-09-06.md).
The deployment-design and storage-preparation sections below describe earlier
checkpoints, not current live deployment status.

The approved scope is an independently designated **fictional staging customer A** for the owner's real Amazon test account. Customer B remains inaccessible. This workflow does not verify ownership of real repairs and must not be described as production customer enrollment or Alexa+ account linking.

```mermaid
sequenceDiagram
  participant C as Signed-in customer
  participant E as Enrollment service (request enabled; redemption gated)
  participant O as Private verified test operator
  participant A as Private fixed-designation approval function
  participant D as Transactional state
  C->>E: Request pairing with consent
  E->>D: Check verified session; create short-lived request
  E-->>C: Random request code (no Amazon ID)
  C->>O: Request code through agreed private channel
  O->>O: Independently verify fictional customer A designation
  O->>A: MFA-protected exact-version invocation (deployment gate)
  A->>D: Fixed customer/identity designation; approval and audit transaction
  A-->>O: Invitation after confirmed transaction
  O-->>C: Single-use invitation through private channel
  C->>E: Request code + invitation + consent
  E->>D: Same session/identity; consume + absent link + audit atomically
  C->>E: Recheck session authorization
  E-->>C: Linked customer scope, or access stays blocked
```

## Customer page

The opt-in HTTP wrapper serves the page using no-store, no-referrer, same-origin scripts/styles/fetch, no framing, and no inline script permissions. It provides no customer-ID selector or Amazon-ID override. A request lasts at most five minutes and is bound to the original verified session. Approval does not extend its expiry.

Pending state keeps Sign out available and does not expose repairs. Redemption must be followed by a successful authorized `/auth/session` read before the page presents a verified connection. Codes are held only in page memory, never URLs, browser storage, telemetry, or console logs. They are cleared on logout, pagehide, and visibility loss; late responses cannot restore them. Clearing a display does not revoke an outstanding server request. The request remains bound to its original session until server expiry; a replacement session cannot redeem it.

## Private approval command

The durable implementation now uses separate source adapters for request start,
operator approval and private redemption. Only the local database-contract facade
composes all three. The private CLI now constructs only an exact-version Lambda
invoker, with no database clients or editable grants. The separate approval
function owns the fixed designation and approval-only adapter. This separation is
not a substitute for deploying distinct IAM roles and testing their denial paths.

Approval leaves the pending request unchanged and atomically creates an immutable
snapshot in the separate approval store plus audit evidence. Redemption obtains
customer scope only from that snapshot, checks the exact request identity,
original session and expiry at commit, then consumes the request and creates the
absent link and audit together. It never edits the approval snapshot. Missing
protected approval evidence or an inline request approval fails closed; there is
no legacy inline-approval fallback or automatic migration of old requests.

Implemented entry point, **not authorization to run it against live AWS**:

```text
node scripts/approve-customer-enrollment.mjs <private-config.json> <private-request.json> <new-private-output.json>
```

Run only after build and after the actual operator identity, resource plan, and IAM scope are reviewed. It is intended for an operator-owned Linux/CloudShell directory with mode 0700 and input files mode 0600, outside the repository (or inside an ignored `.private` directory). Windows execution explicitly refuses to proceed because POSIX mode bits do not establish Windows ACL protection. Do not put request codes, invitations, access keys, or the LWA secret in command arguments or chat. The command does not read LWA secrets.

The config must be a strict JSON object with:

- `purpose`: `fictional_customer_pairing`.
- `account`: reviewed 12-digit AWS account; `region`: the reviewed supported US region.
- `functionArn`: exact same-account/same-region published approval-function ARN with a positive numeric version. No aliases, `$LATEST`, unqualified names or function URLs.

The private request contains only `requestCode` and `confirmation: "approve_designated_pairing"`. Old configs with tables/grants and requests with customer/verification fields now fail strict validation; there is no legacy migration fallback. The invitation output still contains only request code, invitation and operator-approved status.

The command uses its SDK credential chain for synchronous `RequestResponse` invocation, with logs disabled, bounded responses and no automatic retry. IAM must independently limit the operator to the exact approved function version, with MFA, and no direct database writes, role assumption into the writer role, configuration changes or invocation-policy changes. Editing a local ARN must not grant access to another function. The disabled version-2 IAM/MFA test is verified above; enabled approval permissions and transactions still require separate verification.

The approval function requires a separately reviewed `FLO_PRIVATE_APPROVAL_DESIGNATION`: purpose, customerId, identityKey, authorityId, evidenceRef and expiresAt. The identityKey is the existing SHA-256 representation of the LWA client ID and Amazon subject, not email matching. The operator must not control this configuration or its published version. Expiry is an admission deadline for new approvals, not revocation of an already committed approval; existing invitations remain bound to their original short-lived request/session. The designation must come from actual independent fictional-customer verification; do not fabricate it or derive ownership from login alone. No live designation has been provisioned.

The function checks the designated identity before its transaction and compares that same request identity/proof at commit. It needs neither the LWA client secret nor the authentication-state encryption key. `authorityId` records a configured approval authority, not a dynamically authenticated caller. SDK Lambda events and client context do not prove operator identity; STS inside Lambda would identify its execution role. Use AWS-enforced invocation authorization and [programmatic MFA](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_configure-api-require.html), with CloudTrail invocation attribution reviewed separately.

Output is reserved exclusively with mode 0600 **before** any approval attempt; existing files, symlinks, publicly readable inputs, noncanonical/private directories, and malformed request/config input fail closed. Successful output is flushed to disk. The process prints only a generic status, never invitation or SDK error details. Approval creates no customer link: the original customer must still redeem.

If approval or output persistence is uncertain, do not auto-retry, overwrite output, or mint a replacement invitation for the same request. Let the request expire and inspect only necessary private state through a separately reviewed operator procedure. Do not delete or alter live state to make a retry work. Securely remove private local input/output files after the test and record only nonsecret evidence references in project documentation.

## Fictional-staging audit retention

The owner-approved target is 30 days from each original audit event, with asynchronous DynamoDB TTL cleanup and a separate seven-day audit PITR recovery window. Approval and redemption writers now stamp exact expiry and integer TTL; the shared audit visibility helper rejects expired, malformed and legacy records without extending their clocks. This is locally implemented and tested, not a live TTL change or verified AWS restore. No production audit reader/export endpoint exists yet; future tooling must apply the same filter and must never recreate authorization from audit evidence. See [retention implementation and validation boundary](../verification/enrollment-audit-retention-2026-09-05.md). The changed storage template requires fresh cfn-lint/Guard validation; archived pre-retention evidence is historical only.

## Deployment design to review next — not an executable change set

No AWS template, role, mapping, table, or hosted route was changed by this increment. The proposed separation is:

| Component | Intended authority | Must not gain |
| --- | --- | --- |
| Existing customer-read Lambda | Existing verified session and owned-repair reads | General customer-link writes or operator approval |
| Separate customer enrollment handler | Verified website session; start requests and invoke private redemption | Approval writes, direct customer-link writes or access to arbitrary repair data |
| Private redemption service | Check protected approval snapshot; consume request and create absent link/audit atomically | Creating or modifying operator approval evidence |
| Private operator process | MFA-protected invocation of one exact approved function version | Database writes, deployment/configuration changes, or choosing a customer |
| Private approval function | Fixed verified customer/identity designation; atomic approval snapshot and audit | Request/link/repair writes, public routes, client-provided authority |
| Enrollment request table | Short-lived requests, identity guard, admission counter; server-enforced expiry | Restores that revive pending/approved invitations |
| Enrollment approval table | Operator-owned immutable request/identity/session/expiry snapshot and designation | Customer-facing writes; redemption mutations; restores that revive approval authority |
| Enrollment audit table | Append approval/link metadata without codes or credentials | Public reads or logging of raw identity/session tokens |

Review exact IAM action/resource/attribute restrictions and attack paths, route attachment under the existing HTTPS origin, private configuration integrity, encrypted auth-state access, request metadata retention, seven-day operational logs, rate/concurrency controls, and rollback/revocation handling. Transaction actions must remain all-or-nothing within the same account/region; see [DynamoDB transaction behavior](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html). A permissive local SDK client is not proof of deployed IAM separation.

New request/approval/audit storage, transactional requests, separate request and redemption Lambdas, API calls and logs may add usage charges. No live estimate or exact change set has been prepared here. Present actual resources and ongoing costs for approval before execution. Existing scoped synchronous-flow DLQ/VPC exceptions are not blanket approval for unrelated new infrastructure. Never restore authentication or invitation state in a way that undoes logout, expiry, consumption, or link revocation.

Then test the hosted success path plus unlinked, customer B, expired/revoked credentials, logout, replacement session, stolen/replayed invitation, operator/service-credential denial, and transaction conflicts. Website sign-in, local UI tests, and the database emulator do not establish official Alexa+ account linking or certification. Devpost submission and video publication remain paused pending separate final approval.
