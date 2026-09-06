# Enrollment deployment preparation — storage draft and remaining gates

Prepared the [storage-only template and review guide](../../infra/aws/customer-enrollment/README.md). The file is deliberately not a complete runtime stack: final operator authority and scoped execution policies remain unresolved. No live change set was created or executed.

## Fresh checks

- Read-only AWS metadata calls confirmed the existing customer stack is `UPDATE_COMPLETE`, with 14 resources and drift not checked. Operator MFA registration exists; attached/inline policies and groups are empty. Lambda account concurrency is 1,000, with 995 unreserved. Connector identity remains root; it was not used for approval or writes.
- The initial connector calls used SDK-style snake_case operation names and returned `OperationNotFoundError`. Retrying once with this connector's PascalCase operations succeeded; the saved evidence includes successful API call records. No failed result is counted as a completed AWS check.
- IAM Policy Autopilot availability/version verified, then source analysis included the newly added Lambda invocation. Generated wildcard permissions were rejected and saved unchanged with the complete reproducible command. No policy was attached, uploaded or hand-written as a substitute.
- Oregon on-demand DynamoDB unit prices were retrieved using the AWS Price List API. The guide distinguishes request units, retained storage, PITR and future runtime costs; no monthly bill forecast or hard dollar cap is claimed.
- `node scripts/check-enrollment-state-plan.mjs`: passed. Template SHA-256 `58881cef3da86e8dcff4119e3475a5ca9c2ee7078cba2879289118f5b0bd9cbd`. Checks exactly three table-only resources, key schema, explicit encryption, retention, throughput, deliberate backup/TTL treatment and no IAM/routes/functions.
- ESLint on the new check script: exit 0, zero warnings.
- Full existing compiled Windows regression suite: 141 tests / 23 suites; 138 passed, 0 failed, 3 POSIX-only skips. Application TypeScript was unchanged in this increment; no new build or Docker run is claimed.
- CI YAML parsed and the new storage-invariant step was verified present. `git diff --check` passed. No GitHub push or remote Actions run occurred.

## Required next decisions

The user subsequently approved cfn-lint and pinned AWS Guard validation of `infra/aws/customer-enrollment/state.template.json` in isolated CloudShell, with only the nonsecret template uploaded and no deployment. That approval is recorded; it does not need to be requested again for the same scope. These local invariants do not replace schema, policy or change-set validation.

### CloudShell access blocker after approval

**Resolved in the subsequent authorized console session.** The unchanged template has now been validated; see [completed CloudShell results](enrollment-state-cloudshell-validation-2026-09-05.md). The following records the original failed attempt, not the current blocker.

Opened the Oregon CloudShell page and verified that the browser is signed in as `flo-staging-operator`. AWS displayed: "Unable to create the environment. This may be due to insufficient permissions to create environments, or because the environment no longer exists." The terminal did not initialize. The UI error does not distinguish those possible causes. No template upload, validator execution or validation finding is claimed.

No operator permissions were added and the suggested VPC-environment action was not selected. Resume through an existing authorized console identity with functioning `us-west-2` CloudShell access, then verify the installed tooling and pinned rules before upload/validation. Do not transmit passwords, access keys or MFA codes in chat. The approval remains validation-only; no application resource or change set may be deployed under it.

Before runtime deployment, resolve the independently enforced fictional-customer A restriction. A local editable grant file plus direct approval-table write access does not provide that boundary. A private approval service with separately controlled designation/configuration is the proposed next design, not implemented here. Programmatic MFA enforcement also remains separate from console MFA registration.

No AWS resource/role/permission, secret, real customer data/link, hosted route, GitHub remote, Devpost submission or video publication was modified. No password file or secret value was read. Submission and video publication remain paused.
