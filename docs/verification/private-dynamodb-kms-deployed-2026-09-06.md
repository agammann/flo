# Private enrollment database-key correction — deployed and verified

September 6, 2026, 20:45 UTC. **UPDATE_COMPLETE. No customer linked by this update.**

Executed the explicitly approved change set
`flo-private-dynamodb-kms-review-20260906` against `flo-customer-enrollment`
in account `114599789754`, region `us-west-2`, at 20:42:14 UTC.
The fresh preflight verified the exact reviewed template and exactly two
non-replacing managed-policy modifications: ApprovalBoundary and RedemptionBoundary.

## Live verification

- Stack is UPDATE_COMPLETE. Its retrieved template exactly equals the approved
  [update artifact](private-dynamodb-kms-update-2026-09-06.template.json).
- Approval and redemption boundaries are now version v3. Every complete statement
  matches the [tested resolved policies](private-dynamodb-kms-boundaries-REVIEW-ONLY.json).
  The initial position-sensitive equality assertion failed because the patch
  preserves the existing transaction-deny statement before appending KMS statements,
  while the resolved review file places it last. Sorting only the statement list
  established equality; no actions, resources, conditions or duplicate counts
  were discarded, and no further AWS mutation was needed.
- Request boundary remains version v5.
- Request, approval and redemption functions remain Active at published version 3
  with the same three code checksums as before deployment.
- Request is enabled. Private approval and redemption remain disabled in both
  stack parameters and published-function environment flags. ReleaseId is unchanged.
- All 12 credential-free hosted checks passed: public assets, privacy and terms,
  session and malformed-input denials, absent redemption route and protected
  Alexa endpoint. No login, valid-session request, model invocation or customer
  record read was performed by these checks.

The connector used the account-root administrative identity; this is not evidence
of operator MFA or least-privilege operator authorization. No new resources,
recurring key-storage charges, routes, identity grants or customer links were
created. Existing usage remains billable and is not a hard spending cap.

## Remaining work

This closes the reviewed private-role database-key configuration update, not the
enabled hosted ownership-link workflow. Independently confirmed fictional-customer
designation, an exact reviewed private test window, hosted approval/redemption
and wrong-customer/session/replay tests still precede any owned-repair demo claim.
Do not derive repair ownership from Amazon sign-in. Website login also does not
prove official Alexa+ account linking or certification.

The replacement video, its actual audio/caption/thumbnail review and final Devpost
submission remain pending. Source commit
[`32b692e`](https://github.com/agammann/flo/commit/32b692e32a3c8f390743884295e477a99f0576e3)
passed [GitHub verification and actual Docker jobs](https://github.com/agammann/flo/actions/runs/34057363854)
before this documentation-only deployment record.

[Machine-readable deployment and hosted evidence](private-dynamodb-kms-deployed-2026-09-06.json).
