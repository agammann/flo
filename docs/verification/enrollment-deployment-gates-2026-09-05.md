# Enrollment deployment gates — permissions-boundary solution under review

## Completed in this increment

The fixed-designation function and invoke-only CLI from the prior increment remain unchanged. This increment adds a parameterized **permissions boundary**, not a manually derived replacement for the source-generated identity policy. IAM Policy Autopilot does not generate boundaries; the IAM skill permits the service-reference workflow for them. AWS's Lambda service authorization reference was retrieved and confirms Invoke requires lambda:InvokeFunction and supports a function resource.

Files:

- `scripts/enrollment-operator-boundary.mjs`: generates a complete boundary from an exact numeric function version and same-account IAM user ARN. It grants no access on its own.
- `scripts/enrollment-operator-boundary.test.mjs`: local structure and invalid-target tests.
- `infra/aws/customer-enrollment/operator-boundary.EXAMPLE-NOT-FOR-DEPLOYMENT.json`: complete tested example, with an explicitly hypothetical function. Do not attach this example.
- `docs/verification/enrollment-operator-boundary-simulation-2026-09-05.json`: unchanged AWS simulator and Access Analyzer results, tested documents, and read-only preflight.

The source-generated identity baseline remains rejected for standalone use. An attached boundary could constrain its effective permissions, but attachment requires a separate exact-target review and verification that all intended principals/resources have the correct restrictions. Do not attach the baseline first and leave a period of broad access.

## Boundary statements and scope

1. `MaximumExactVersionWithFreshMfa`: maximum allowance for lambda:InvokeFunction on one numeric published version, for the exact IAM user, with MFA present and age from zero through 900 seconds.
2. `DenyOtherCapabilities`: explicit denial of operations other than invocation; prevents database writes, IAM/deployment changes and assuming a writer role through this identity's permissions. Authentication operations such as GetSessionToken and identity introspection are special AWS cases, not shop authorization capabilities.
3. `DenyOtherFunctionsAndVersions`: explicit denial of invocation outside that one resource, including aliases and unqualified names.
4. `DenyOtherPrincipals`: rejects a different supplied principal context; does **not** constrain the actual account root or principals to which this boundary is not attached.
5. `DenyMissingOrFalseMfa`, `DenyMissingMfaAge`, `DenyStaleMfa`, `DenyInvalidMfaAge`: explicit denials for absent, false, older-than-900-seconds or invalid MFA context. Explicit denies matter because implicit boundary denies alone can be bypassed by some same-account direct resource-policy grants.

The selected proposed credential flow is **MFA-authenticated GetSessionToken**, not an assertion in the Lambda payload. AssumeRole has different MFA propagation semantics and is not an interchangeable substitute for this boundary. The operator must acquire temporary credentials privately; do not paste credentials or TOTP codes into chat, source or command history. A simulator-supplied MFA context is a test fixture, not evidence that credentials contain it.

Official references: [permissions-boundary evaluation](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html), [MFA API access and credential-flow differences](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_configure-api-require.html), [Lambda service authorization reference](https://servicereference.us-east-1.amazonaws.com/v1/lambda/lambda.json).

## Live read-only evidence

The connector is account root in 114599789754. It was used only for metadata and policy simulation/validation, never a customer approval or credential issuance. The operator still has no attached policies, inline policies or group memberships; one MFA device is registered. Oregon lists only the narrator and customer-site Lambda functions. No private approval function exists yet, so no real numeric approval version ARN can be supplied or tested now. This is scoped evidence, not an account-wide authorization audit.

A subsequent ListAccessKeys metadata-only check found zero access keys for this operator; [the response](enrollment-operator-credential-metadata-2026-09-05.json) contains no secret values. The proposed GetSessionToken workflow therefore also needs a separately reviewed private credential bootstrap, or a redesigned MFA-at-AssumeRole path with different boundary conditions. Do not issue a persistent key implicitly, use the root connector as the operator, or claim an ordinary console session supplies suitable GetSessionToken source credentials.

The initial connector calls used boto3-style snake_case operation names and failed before reaching AWS with OperationNotFoundError. Corrected calls used the connector's required AWS operation names, such as GetCallerIdentity, and succeeded. Only those successful calls support the current-state statements.

## Verification

AWS Access Analyzer ValidatePolicy returned **zero findings** for the boundary document. Twelve IAM SimulateCustomPolicy cases tested it together with the unmodified generated invocation baseline:

| Case | AWS simulator result |
| --- | --- |
| Exact target, correct principal, MFA age 0 | allowed |
| Same, MFA age 900 | allowed |
| MFA age 901 | explicitDeny |
| Missing MFA and age | explicitDeny |
| MFA false | explicitDeny |
| MFA true but age missing | explicitDeny |
| Other version | explicitDeny |
| Other function | explicitDeny |
| Unqualified function | explicitDeny |
| Root ARN supplied as hypothetical principal context | explicitDeny; not a real root restriction |
| DynamoDB PutItem | explicitDeny |
| Lambda configuration change | explicitDeny |

Both new local tests passed, focused ESLint passed, and git diff --check passed. The application source was not changed in this increment; its full suite/build/Docker results remain those of the preceding verified increment, not a newly rerun application suite. No actual MFA credential, expired-token rejection or real function invocation was tested. Simulations do not model every account policy, credential validity, or deployed resource-policy interaction.

## Resolve the remaining owner decisions and deployment dependency

### Audit retention — subsequently approved and implemented locally

The user subsequently approved the 30-day target. [Retention implementation](enrollment-audit-retention-2026-09-05.md) adds writer expiry/TTL and filtering, changes the template, and preserves previous validation as historical only. No live TTL change or deletion has occurred. The paragraph below records the original proposal, not a remaining request for the same approval.

Propose a 30-day retention target for fictional staging audit records, with explicit expiry filtering in any read/export/recovery tooling and DynamoDB TTL for eventual cleanup. TTL is asynchronous and is not a promise of physical deletion at day 30. The existing seven-day PITR recovery window is separate; a restored snapshot must be reconciled before use and must never reconstruct links or authority. No archive, external export, backup restore or hard deletion is approved here. The user has been asked to confirm the 30-day target. Until then, the hash-pinned storage template and prior exceptions remain unchanged.

### Real test designation — do not fabricate a subject/hash

The enrollment function's designation must associate the **server-verified** Amazon identity with fictional customer A. The restricted request service can create a short-lived request only from the authenticated original session. During the supervised test, the owner privately supplies that request code; a separately trusted administrator reviews the specific pending request's identity hash and records the owner's explicit fictional-A assignment. This is a designation of synthetic test data, not proof of ownership of real repair records. Do not match by email, read whole auth tables, expose access tokens or use root to impersonate an operator approval.

The operator cannot choose or change this deployment configuration. Provisioning the designation is a separate controlled administrative action; it must occur before enabling approval. The approver must remain disabled when designation is absent or expired. No live customer ID, identity hash or evidence reference was invented or provisioned in this increment.

### Staged deployment sequence

1. Approve the audit retention treatment and implement/test the corresponding source/template changes; revalidate changed templates and re-review hash-pinned exceptions.
2. Complete the source-generated runtime policy artifacts and their restrictions for request, approval and redemption separately. The operator boundary does not solve runtime permissions or supply a writer execution role.
3. Prepare the storage/runtime plan with approval disabled and no operator grants, validate exact templates and examine the change set/resource costs. Obtain execution approval before creating application resources.
4. After a numeric approval version exists, generate and validate its exact operator boundary (never the hypothetical example), review resource policies and expected denied operations, then obtain approval for boundary/grant attachment and the private MFA credential setup.
5. Establish the real independent test designation, enable only the reviewed version, perform actual successful/rejected operator calls, and test hosted original-session pairing/customer B isolation. The deployment design must handle publishing a new version without leaving stale operator permission targets.
6. Complete separate Alexa+ checks and release reconciliation. Submission and video publication remain paused until separate final approval.

No CloudFormation template, AWS resource, permission attachment, live designation, secret, GitHub remote, Devpost submission or video publication changed during this increment.
