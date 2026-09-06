# Enrollment runtime preparation — not deployed

September 6 UTC / September 5 Pacific. This is source and policy-simulation evidence, not approval to deploy or proof of hosted pairing.

## Implemented

The [generator](../../scripts/build-enrollment-runtime-template.mjs) produces a [27-resource template](../../infra/aws/customer-enrollment/runtime.template.json) for a separately reviewed `flo-customer-enrollment` stack in account `114599789754`, us-west-2. Three permission boundaries constrain unchanged [IAM Policy Autopilot baselines](../../infra/aws/customer-enrollment/runtime-autopilot-baselines.json) and the standard Lambda logging policy. The complete generation commands and version 0.3.0 output are retained. Generated broad policies must never be attached without the exact reviewed boundaries.

| Role | Maximum capability | Excluded |
| --- | --- | --- |
| Request | Session reads; session/link condition checks; request/admission writes; exact redemption version invocation | Approval/link writes, repair reads, arbitrary invocation |
| Redemption | Session/approval reads and checks; atomic request consumption and link/audit writes | Approval creation, repair reads, function invocation |
| Approval | Pending-request reads/checks, session/link checks, approval/audit writes for deployment-controlled fictional designation | Link writes, request mutation, repair reads, invocation |

Explicit denies cover unlisted actions and out-of-scope resources, including direct role-session resource grants. Put/Update writes are denied outside `TransactWriteItems`, including when the enclosing-operation key is absent. This does not prove the application includes every required transaction condition: trusted code and regression tests remain necessary. Deployment administrators can change code/policies and remain trusted. A boundary alone grants nothing.

## Resource plan — requires separate approval

18 unconditional resources: three functions, three published versions, three execution roles, three baseline policies, three boundaries, three log groups. Nine conditional resources: one integration, four routes and four route-specific Lambda permissions.

- Enrollment, public routes and approval all default disabled; designation defaults to `null`. No fabricated identity mapping is embedded.
- Each function: 256 MB, reserved concurrency one, 20-second request / 10-second private timeout. Logs: seven-day retention, retained on deletion/replacement. No payload logging, VPC, NAT gateway, queue, DLQ or provisioned concurrency is added.
- Approval/redemption have no HTTP route or function URL. API Gateway invokes only the published request version on four exact method/path combinations, scoped to the source account and existing API. Existing API stage/log/throttle settings are not modified and must be rechecked before routes are enabled.
- Artifacts require content-addressed ZIP keys, immutable S3 versions and base64 SHA-256 publication checks. Every code/configuration update requires a new reviewed `ReleaseId` to publish new versions. Retained old versions are not automatically authorized for invocation.
- Existing table names and the auth-state secret ARN are parameters. CloudFormation resolves `encryptionKey` privately; runtime roles have no Secrets Manager permissions. Approval receives neither the state key nor LWA client ID. No LWA client secret is in this template.
- No new tables, records, users, operator grants, website replacement, restoration or customer mappings.

Lambda/API/log/artifact usage and retained versions/logs have ongoing costs. Limits are not a dollar cap. Current rates, exact artifacts, IAM changes and resource replacements must be reviewed before execution. Earlier storage approval does not cover this runtime.

## Verification

Local build/typecheck passed all 13 workspaces. Full suite: 151 tests, 148 passed, three platform skips, zero failures. Lint passed after fixing an explicit Node Buffer import in a new test. Seventeen additional boundary/template tests passed; CI now runs them. Template/generator parity and unmodified baseline preservation are tested.

[AWS evidence](enrollment-runtime-boundary-2026-09-06.json) contains policies, case-level decisions and API metadata. No policies were attached and no customer records were read or written.

- Access Analyzer: zero findings for all three boundaries.
- 105 transactional table/action cases plus 30 missing-enclosing-operation cases: 18 allowed, 117 explicit denies, all as expected. A broad simulated identity policy tests the boundary maximum, not an actual grant.
- Twelve meaningful function/version cases: one allowed, eleven explicit denies. Unqualified names, aliases and another numeric version are rejected. Proposed names/version 1 are not deployed references.
- **Logging unresolved:** twelve log cases returned implicit deny, including expected allowed streams. A separate single-resource check returned the same result for the full boundary and a minimal exact-resource Allow control. This does not establish the cause. No wildcard-log workaround was applied. Resolve through official tooling and live role/log-delivery verification before enabling routes.

The local matcher is a small grammar-specific helper, not an IAM simulator. AWS simulation is not proof of live service authorization. cfn-lint/Guard have NOT run on this new template; earlier storage results do not cover it. No runtime change set exists.

## Next gates

1. Obtain approval to validate this new runtime template with existing isolated Docker tooling and applicable pinned IAM/Lambda/log/API Guard rules. No new installation is required. Keep raw findings visible and review any scoped exceptions.
2. Resolve the log simulation discrepancy; validate final substituted policies and actual parameters, package/hash artifacts, then prepare a separately reviewed change set. Review costs and exact resources before executing.
3. Choose/test the operator credential/MFA path and independently verify the fictional customer designation before attaching operator access or enabling approval. Amazon sign-in, email matching, a local grant file and service credentials do not prove repair ownership.
4. Test real hosted pairing and rejection paths, then complete applicable separate official Alexa+ checks. Record/review the replacement demo only against verified behavior. Publication and Devpost submission remain paused for separate final confirmation.

## Official references consulted

- [IAM boundaries](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html) and [policy simulator](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_testing-policies.html).
- [DynamoDB transactions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html).
- Programmatic references for [DynamoDB](https://servicereference.us-east-1.amazonaws.com/v1/dynamodb/dynamodb.json), [Lambda](https://servicereference.us-east-1.amazonaws.com/v1/lambda/lambda.json), and [Logs](https://servicereference.us-east-1.amazonaws.com/v1/logs/logs.json): action/resource/condition definitions checked before constructing boundaries.
- [Lambda execution roles](https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html): documented execution-role service trust, without assuming service-to-service SourceArn keys are populated on AssumeRole. API Gateway permissions are separately source-scoped.
