# Operator login and bounded invocation review — 2026-09-06

Historical review artifact: the owner later approved a temporary attachment and
one actual DryRun was denied. The grant, boundary attachment and temporary policy
were then removed. See the [execution and cleanup checkpoint](operator-disabled-test-2026-09-06.md).
The JSON's REVIEW_ONLY status describes the original review, not an active policy.

The later [fresh-MFA live test](operator-fresh-mfa-test-2026-09-06.md) passed
exact-version authorization and the disabled handler check. Temporary permissions
were again removed and verified. The sections below preserve the original review.

## Result and scope

Real local CLI sign-in succeeded as
`arn:aws:iam::114599789754:user/flo/flo-staging-operator`, immutable user ID
`AIDARVLVOAS5N5MWSFYR5`. STS confirmed the identity after replacing the profile's
old root-session reference. No password, MFA code or cached credential is stored
in this evidence. The separately approved `SignInLocalDevelopmentAccess` v3
attachment was verified; no invocation policy or permission boundary is attached.

This increment changes local review tooling and documentation only. No Lambda,
customer link, designation, function route, deployment stack, or release state
was changed. Submission and replacement-video publication remain paused.

The live enrollment stack remains `UPDATE_COMPLETE`, with `EnableEnrollment`,
`EnableApproval`, and `PublishRoutes` all false. Approval version 2 is Active
with successful configuration status and `FLO_PRIVATE_APPROVAL_ENABLED=false`.
Its code SHA-256 is `mLliFC/rg/nKjkoD3RihLAwZjo7RWg4yGkFIQs/GDTM=`.
The environment's designation field being present is not proof of a valid or
independently verified customer designation. No such proof is claimed here.

## Local boundary correction — NOT attached

The legacy invocation-only boundary explicitly denied the sign-in actions.
`operatorLoginBoundary` now composes a review-only alternative with:

- Maximum invocation of **only**
  `arn:aws:lambda:us-west-2:114599789754:function:flo-customer-enrollment-approval:2`.
- Exact operator principal, MFA present, MFA age in the inclusive range 0–900
  seconds, and an explicit invocation deadline. Missing or invalid context fails
  closed. The proposed review expires at **2026-09-06 18:00 UTC**; an expired plan
  must not be silently extended.
- Only `signin:AuthorizeOAuth2Access` and `signin:CreateOAuth2Token` on
  `arn:aws:signin:us-west-2:114599789754:oauth2/public-client/localhost` for the
  exact operator. This bootstrap exception never applies to Lambda invocation.
- Explicit denials for other capabilities, principals, function versions, and
  sign-in targets, including other accounts/regions and the remote client.
- No database, secret, configuration, role-assumption, customer-data, or
  deployment permission. A boundary grants nothing by itself.

The [complete boundary, unchanged generated identity baseline, inputs and AWS
simulation results](operator-login-boundary-review-2026-09-06.json) are the review
artifact. The generated identity baseline has wildcard function scope and is
**not acceptable as a standalone grant**. Attach/verify the restrictive boundary
before any separately approved invocation baseline; remove the invocation grant
before removing its boundary during cleanup. Retain the existing sign-in-only
policy unless the owner separately approves changing it.

The IAM skill kept source-derived identity analysis separate from the hand-built
maximum-permission boundary. Autopilot was rerun against the unchanged TypeScript
invoker and reproduced the archived baseline exactly:

```text
uvx iam-policy-autopilot@latest generate-policies C:/Users/alexa/Documents/Codex/2026-09-03/jo/benchflow/services/flo-mcp/src/customer-enrollment-approval-invoke.ts --region us-west-2 --account 114599789754 --service-hints lambda --pretty
```

The first local tool attempt failed because uv referenced a missing managed
Python runtime. Retrying with the existing bundled Python and private uv cache
succeeded, with telemetry disabled and no upload flag. No manual source-derived
identity policy was substituted.

## Verification

- Windows build: all 13 workspace configurations passed.
- Windows application suite: 151 tests, 148 passed, 3 platform-specific skips,
  zero failures. Typecheck and lint passed.
- Linux application suite: 151 tests, 150 passed, 1 platform-specific skip,
  zero failures. The initial extra full-suite run inside the runtime image
  stopped on missing repository-only fixtures. The verified rerun mounted only
  `infra`, `Dockerfile`, `docker-compose.yml`, and `.env.example` read-only,
  used `NODE_ENV=test` and `--network none`, and supplied no AWS credentials.
- Operator/runtime boundary and template suite: 26 passed, zero failures,
  including review-artifact/generator parity.
- Real local Docker Engine and Compose are available. The six-service disposable
  demo started and passed the HTTP-to-MCP diagnostic, parts comparison,
  corrected gross-profit ranking, estimate approval, resumed context, confirmed
  purchase/scheduling, owner-only review and duplicate-confirmation denial.
  The final source was rebuilt and this workflow and the database contracts were
  rerun successfully. Final image ID:
  `sha256:e0e7ad0fa81972246baacfdaec43eb97b9ccb114e6269a02d6c5462af9cfe47c`.
- Network-disabled request/redemption and approval bundle smoke tests passed.
- The isolated DynamoDB Local contract suite passed actual emulator transactions,
  encrypted persistence, trusted linking, customer A/B isolation, immutable
  approval, eight-way redemption/replay, atomic rollback, expiry and logout.
- Hosted customer staging: all 16 credential-free asset/security/pre-login
  denial checks passed. No provider login or customer mapping was created.
- AWS `SimulateCustomPolicy`: all 26 allow/deny cases matched. Coverage includes
  MFA ages 0/900/901, missing/false MFA, missing/negative age, wrong principal,
  old/latest/unqualified function targets, exact deadline, missing time, direct
  database/configuration/role access, and local/remote/wrong-region/wrong-account
  bootstrap targets for both sign-in actions.

These simulations supply MFA context as test input. They do **not** establish
the context of the actual CLI credentials. The emulator is not an AWS IAM test;
the website smoke check is not a linked-customer success or Alexa+ linking test.

## Next approval gate

Review attachment of the exact boundary plus the source-derived invocation
baseline to this operator only. The proposed first test is at most four Lambda
`DryRun` authorization checks and one synchronous empty-payload invocation of
the verified **disabled version 2**, with no automatic retry, no logging tail,
no enablement and no customer records. If AWS rejects MFA context, preserve the
restriction and diagnose; do not drop MFA or substitute root credentials.

IAM policy attachment adds no provisioned application resource. The single
executed Lambda request and operational logs may add usage charges; this is not
a dollar cap. No new table, KMS key, VPC, queue, or route is part of this review.
Actual stale-credential rejection, enabled enrollment, independent fictional A
designation and hosted customer A/B tests still follow separate scoped reviews.

## Official references

- [AWS CLI sign-in](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html)
- [Sign-in policy](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/SignInLocalDevelopmentAccess.html)
- [Machine-readable sign-in action/resource reference](https://servicereference.us-east-1.amazonaws.com/v1/signin/signin.json)
- [AWS MFA API enforcement](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_configure-api-require.html)
- [Matching upstream browser 400 report](https://github.com/aws/aws-cli/issues/10186)

Browser authorization succeeded in the later attempt after the approved sign-in
permission change and private-browser instructions. This does not isolate which
change resolved the earlier 400 error; do not claim a proven cookie root cause.
