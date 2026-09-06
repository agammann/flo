# Controlled enrollment test readiness — 2026-09-06

## Later checkpoint: operator login verified

The [fresh-MFA live operator test](operator-fresh-mfa-test-2026-09-06.md) now
passes real exact-version authorization and one disabled version-2 invocation,
which returned `ok=false`, `status=503`. Four DryRuns included two rejected
out-of-scope targets. Temporary permissions were removed and sign-in-only access
restored. No customer link or enabled enrollment workflow was tested.

The credential-path observations below are historical. Real local CLI login and
STS verification now succeed as the intended IAM operator, with only the approved
sign-in policy attached. A login-compatible, expiring invocation boundary passed
26 AWS simulations and was temporarily tested live, then removed. Local Compose and database contracts
were rerun successfully. See the [later review and next approval gate](operator-login-boundary-review-2026-09-06.md).

## Outcome

Read-only preflight and simulation completed. No live permissions, function
configuration, routes, credentials or customer state changed. Enrollment,
approval and public pairing remain disabled. Submission and video publication
remain paused.

At 15:46:03 UTC, the exact operator still has immutable ID
`AIDARVLVOAS5N5MWSFYR5`, one MFA device, zero access keys, zero attached or inline
user policies, and zero groups. The connector is account root, not this operator.
The enrollment stack is UPDATE_COMPLETE with all three gates false.

## Verification completed this turn

- Build and typecheck passed all 13 workspace configurations.
- Full application suite: 151 tests, 148 passed, three platform-specific skips,
  zero failures.
- ESLint passed with zero warnings.
- Operator/runtime boundary and template tests: 23 passed, zero failed.
- Thirteen SimulateCustomPolicy cases against the actual approval version 2 ARN
  matched expectations. Fresh MFA ages 0 and 900 allowed; age 901, missing/false
  MFA, missing/negative age, other principal, old version, latest version, direct
  table writes and configuration changes denied.

Simulation used the unchanged archived Autopilot invocation-only identity
baseline plus the existing separately generated maximum-permission boundary.
Nothing was attached. Simulated MFA values are supplied test inputs, not proof
of a live operator credential. Simulating a root ARN against this policy does
not restrict the real account root.

The original source-analysis reproduction command remains:

```text
uvx iam-policy-autopilot@latest generate-policies C:/Users/alexa/Documents/Codex/2026-09-03/jo/benchflow/services/flo-mcp/src/customer-enrollment-approval-invoke.ts --region us-west-2 --account 114599789754 --service-hints lambda --pretty
```

Autopilot was not rerun in this read-only increment; the existing baseline was
reused unchanged. Its wildcard resource is not accepted as a standalone grant.

## Credential-path gate

The current shell cannot find `aws`. The operator's console login does not
establish programmatic authorization. No long-term key should be created to
work around this.

AWS documents browser-based `aws login` (CLI 2.32.0+) as a temporary-credential
path using console credentials, with separate SignInLocalDevelopmentAccess
permission. Installation and interactive login require confirmation. A separate
profile must preserve existing credentials. Never sign the operator test as root.

There is an additional design check: the current invocation-only boundary
explicitly denies all non-invocation actions. Adding a sign-in identity policy
alone would not overcome that deny. Review only the necessary authentication
actions/resources before attaching a final boundary. Do not attach a broad
managed policy and assume it fixes the workflow. The resulting credential must
also pass an actual AWS-enforced MFA-age check; the login documentation alone
does not prove those condition keys are available.

References: [CLI browser login](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html),
[programmatic MFA semantics](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_configure-api-require.html).

## Ordered controlled-test plan — not execution authority

1. Establish the exact non-root temporary-credential path and review its
   bootstrap permissions. No customer access grant or permanent access key.
2. Review a short-lived invocation-only grant/boundary and one disabled-version
   check to establish actual credential/MFA behavior. Do not enable data access
   based solely on simulation. Deny missing/stale MFA, wrong versions, direct
   database access and configuration changes.
3. Independently designate the owner's verified Amazon test identity for
   fictional customer A only, with a private evidence reference and finite
   admission deadline. Do not use email matching, guessed identity hashes,
   user-supplied customer IDs or login alone as proof.
4. Review a new versioned configuration for the enabled private functions and
   update exact invocation references. Version 2 remains a disabled checkpoint,
   not the final enabled approval version. Keep public routes false until a
   separate same-origin route review and permission test.
5. Review the exact test records, maximum request count, TTL/retention, uncertain
   result procedure and revocation/cleanup before any stateful AWS tests.
   Never refill allowances or overwrite live links to make tests pass.

### Required test matrix

| Case | Required evidence |
| --- | --- |
| Signed in but unlinked | Signed-in verification message, sign out available, no repairs |
| Approved fictional A, original session | Approval transaction confirmed; redemption creates absent link and audit atomically; only A visible |
| Customer B or unknown repair | Equivalent generic denial; no B asset/estimate data |
| Wrong Amazon identity | Fixed designation mismatch rejected before approval write |
| Client customer/identity override | Strict input rejection; no state change |
| Service/root credentials offered as customer login | Rejected; no customer session or repair authority |
| Expired/revoked customer credentials | Request and repair access rejected |
| Logout or replacement session before redemption | Original proof cannot create a link |
| Expired request or designation | No new approval/link; approval does not extend request lifetime |
| Stolen invitation in another session | Rejected; no link |
| Replay or concurrent redemption | At most one consumed request, one link, one corresponding audit outcome |
| Storage error or uncertain private output | No success claim, no automatic retry; original request expires |
| Cross-job estimate | Ownership checked before estimate access, no foreign estimate |
| Operator stale/missing MFA or alternate target | Actual AWS rejection, not merely CLI input validation |

Record sanitized statuses, timestamps and request IDs only. Do not publish
identity subjects/hashes, session cookies, invitations, MFA codes or secrets.
Successful website pairing still does not prove Alexa+ account linking.

[Machine-readable preflight and simulations](enrollment-controlled-test-readiness-2026-09-06.json).
