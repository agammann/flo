# Enabled approval version-4 operator review — 2026-09-08

Status: **REVIEW ONLY. No permission attached, AWS login started, approval performed or customer linked.**

The deployment is UPDATE_COMPLETE. Exact private approval target:
`arn:aws:lambda:us-west-2:114599789754:function:flo-customer-enrollment-approval:4`.

Operator: `arn:aws:iam::114599789754:user/flo/flo-staging-operator`, immutable user ID `AIDARVLVOAS5N5MWSFYR5`.
Existing identity has only SignInLocalDevelopmentAccess, no inline policies, group membership or boundary.
Local CLI 2.36.40 is installed, but the `flo-staging-operator` profile reports its session expired.
Use a separately approved `aws login --profile flo-staging-operator --region us-west-2`; do not reuse old callback URLs or substitute the administrative AWS Core connection.

## Permission plan for approval

- Temporary managed maximum-permissions boundary from the existing tested `operatorLoginBoundary` generator, targeting numeric approval version 4.
- Exact operator principal; MFA present; MFA age 0–900 seconds inclusive; invocation before **2026-09-08T06:45:00.000Z**.
- No database, secret-read, deployment, role-assumption or other Lambda invocation access.
- The same-account local CLI sign-in exception is retained; it never bypasses Lambda MFA controls.
- Separately attach the reproduced Autopilot invocation baseline only AFTER the boundary is attached and verified. The generated baseline contains wildcard function resources and is unsafe on its own. The mandatory boundary enforces the exact target and fresh-MFA restrictions.
- Do not change the original SignInLocalDevelopmentAccess attachment.
- Remove the temporary invocation grant first, then its boundary attachment and temporary managed policy on completion or failure. Do not remove other project resources or data. Do not silently extend the deadline.

The complete generated boundary, unchanged source-derived baseline, case inputs, simulation output and current inventory are in the adjacent JSON. These are not currently attached policies.

## Verification

- Autopilot 0.3.0 reran against the current TypeScript approval invoker and reproduced the archived invocation-only baseline.
- AWS Access Analyzer: no findings on the proposed boundary.
- All 30 AWS simulations of baseline + actual sign-in policy + maximum-permissions boundary matched expectations.
- Coverage: fresh/stale/missing/negative MFA age; false/missing MFA; wrong user/root; old/latest/unqualified versions; expired/missing current time; database reads/writes; secret reads; configuration changes; role assumption; redemption invocation; local/remote/wrong-region/wrong-account login targets.
- All 5 local operator-boundary regression tests passed.
- These synthetic IAM contexts are not proof of the new actual CLI credential context. A real exact-version DryRun is required.

## Proposed bounded actual test sequence — requires explicit approval

1. Complete fresh non-root AWS browser MFA and CLI login. STS must match the exact operator. Do not interpret another OAuth authorization on an old browser session as fresh MFA.
2. Apply/read back the maximum-permissions boundary first, then the generated invocation grant.
3. At most five DryRun requests: the exact version, previous version 3, unqualified approval and redemption version 4, with at most one deliberate additional exact-version propagation check after unchanged-policy read-back. No automatic retries.
4. At most one synchronous empty-object validation call to approval version 4; expect application `ok=false,status=400` without an approval write.
5. Once the owner has a fresh authenticated Flo session and explicitly consents, create one new fictional enrollment request. The old saved request is expired and must never be reused.
6. At most one actual private approval invocation for that new request. Save the invitation privately, without log tail or printing the payload. Only the configured observed identity and fictional customer A are eligible.
7. Explicit customer redemption creates a persistent fictional-A link and consumes the invitation. This is a real staging-state mutation, not merely a sign-in test.
8. Verify linked-A authorization and rejected customer override/B access, replay, and logout as available. Never fabricate evidence of repair access if no reviewed fixture records exist. This scope does not seed repair data, link B, use another person's Amazon account, or change a real shop record.
9. Remove temporary IAM permissions and verify cleanup. Preserve the intended test link/audit records; removing IAM permissions does not revoke a created customer link.

If identity, MFA, IAM or state validation fails, stop before mutation. Do not loosen the policy, use root for the operator invocation, reuse an uncertain request or silently issue another invitation.
The application designation separately expires 2026-09-08T09:25:13.430000+00:00.

This adds no provisioned application resource, but invocations, API traffic, state writes and logs may incur usage charges. The request counts are the test plan, not an IAM-enforced spending or invocation cap. Submission and video publication remain paused.
