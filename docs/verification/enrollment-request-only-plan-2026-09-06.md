# Request-only identity verification stage — review, not deployment

Latest checkpoint: the [corrected AWS change set](enrollment-request-only-changeset-2026-09-06.md)
is CREATE_COMPLETE with no reported pre-deployment validation errors, but remains
unexecuted. It includes the function-description publication correction and its
fresh validation. The sections below describe the initial request-only plan.

## Why this increment exists

The real operator/MFA disabled-version test is complete. The remaining customer
designation must bind a provider-verified Amazon identity to independently
authorized fictional customer A. The existing request service can establish the
provider/session proof, but the old deployment switch enabled request processing
and private redemption together. This change separates those gates before any
public request collection. It does not assert a currently exploitable bypass.

## Local implementation

- Added `EnableRedemption`, default false. It supplies the existing private
  redemption handler's `FLO_ENROLLMENT_ENABLED` value independently of requests.
- `EnableEnrollment` continues to govern the request handler. `EnableApproval`
  remains a separate fixed-designation approval gate, default false.
- The redemption route and its API Gateway invocation permission require all
  three of PublishRoutes, EnableEnrollment and EnableRedemption. The page, asset
  and request route require only PublishRoutes plus EnableEnrollment.
- All existing IAM baseline and boundary documents, code bundles, storage,
  encryption settings, retention and concurrency are unchanged by this increment.
  IAM authority alone is not the request-only safeguard: the exact deployed
  redemption version must independently be verified disabled.
- The generated template still has 27 resources and defaults all four gates off.
  New immutable function versions and the exact request-to-redemption reference
  must be reviewed before execution. Do not update an old published version.

| Proposed stage | Requests | Public routes | Redemption | Approval |
| --- | --- | --- | --- | --- |
| Disabled validation | false | false | false | false |
| Request-only, separately reviewed | true | true | false | false |
| Stateful pairing test, later review | true | true | true | true |

These parameter rows are a proposal, not permission to execute a change set.
Request-only exposure adds three routes on the existing origin, not an approval
endpoint or a redemption route. It can write short-lived request, identity-guard
and admission-counter records; it is not a read-only or zero-cost operation.
The preexisting per-window limits are not a hard spending cap.

## Required before request-only execution

1. Fresh cfn-lint and pinned AWS Guard checks against these exact template bytes.
   Preserve raw findings and existing scoped synchronous DLQ/VPC and default-log
   encryption treatments; do not label exceptions as passing policies.
2. Read back the existing stack, exact version/code references, no-route state,
   throttles and IAM scope. Prepare a review-only change set with new release ID
   and all prior parameters preserved except the explicitly reviewed gates.
3. Review actual replacements/additions, costs, request count and abort procedure.
   Confirm disabled approval/redemption versions before exposing the request page.
4. Authenticate the owner at the actual hosted LWA origin. Use the website's
   original verified session, not AWS operator credentials, for request creation.

## Independent fictional-customer designation

The owner's authorization of fictional customer A is distinct from Amazon's
identity proof. The owner must confirm the observed request is theirs through
the agreed private operator channel. A request code by itself is not proof of
repair ownership and must not confer authority over arbitrary customer records.

Prepare a separately reviewed exact-record inspection procedure for the observed
request, returning only the necessary identity fingerprint and validity metadata
to private deployment tooling. Do not scan/decrypt all login sessions, expose raw
Amazon subjects, fetch client secrets, or grant the invocation-only operator
database or configuration permissions. That private procedure is not implemented
or authorized by this document. Never choose the newest login as an identity match.

Bind the independently authorized fictional customer A, verified identity key,
configured authority, genuine evidence reference and finite deadline in the
protected designation. Never invent the identity hash or evidence reference.
Do not map customer B. No real repair ownership or official Alexa+ linking is
established by this fictional test designation.

The first request may expire while the designation/configuration is reviewed.
Let it expire normally. After the enabled-version plan is approved, start a new
request from the same verified identity/session flow; do not extend or revive the
old request. The configured identity must match the new request independently.

## Later stateful verification

Review a bounded request/call budget and explicit cleanup/revocation procedure
before approving any link write. Verify customer A success, customer B denial,
unlinked identity denial, expiry, logout, replaced session, invitation theft and
replay, service-credential rejection and transaction conflicts. Check committed
state after uncertain results; never auto-retry or delete evidence to force success.

## Current evidence boundary

All 27 local boundary/template tests pass, including eight gate combinations and
unchanged baseline parity. The full Windows build and typecheck passed all 13
workspace configurations; 151 application tests ran (148 passed, three platform
skips, zero failures), and ESLint completed with zero warnings. These do not
replace CloudFormation schema or policy validation.

The existing isolated Docker validator image is available locally at
`sha256:96708ef9c58f9210b7aaa9e0fddccd8371cbdcdfbd5cea202bfdc58d49fd6d90`.
No new tool installation is needed. Fresh validation approval should name the
changed `infra/aws/customer-enrollment/runtime.template.json` and use the pinned
AWS rules with no network or AWS credentials in the container.

The [fresh local validation](enrollment-request-only-validation-2026-09-06.md)
is complete: cfn-lint reports no findings; Guard has the same three scoped policy
failures and 12 property failures, with no added failure signatures. AWS change-set
validation of this new increment remains pending. Nothing was deployed, no public route was
published, and no customer identity or designation was read or created this turn.
Video and Devpost publication remain paused for separate final approval.

Condition composition follows the [official CloudFormation condition syntax](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/intrinsic-function-reference-conditions.html).
