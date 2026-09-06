# Fictional customer A: owner designation confirmed, identity handoff pending

September 6, 2026, 21:01 UTC. This is a read-only preparation checkpoint.

**Later outcome:** the owner approved the window, the live private observation
succeeded, and temporary permissions were removed. See the
[completed handoff](fictional-a-identity-observed-2026-09-06.md). Review-time
pending statuses below are historical.

The owner explicitly confirmed that their own Amazon account may represent
fictional demo customer A only. Customer B and all real customer records remain
outside this authorization. This settles the fictional test assignment; it does
not identify the exact Amazon subject or itself create a customer link.

## Verified now

- The enrollment stack remains UPDATE_COMPLETE with request enabled and approval
  and redemption disabled, after the completed private KMS correction.
- The exact IAM operator still has only SignInLocalDevelopmentAccess, no inline
  grants and no permissions boundary. The administrative connector identifies as
  account root and is not used as a substitute for the operator identity read.
- The old CloudShell tab reported signed out. Reconnect returned the correct
  operator account but CloudShell could not create/open its environment. Its
  temporary bootstrap grants are absent; no new grant was attached.
- The current verifier SHA-256 matches the last uploaded diagnostic source:
  `a48d0d8eed12578cf54b2dd8157e04e04cb294689ed9e32e13a3731930c1f45d`.
  All 13 verifier tests passed in the existing isolated Linux Docker image,
  network disabled, source read-only, no AWS credentials.
- All 57 AWS simulations passed with both intended identity inputs (unchanged
  Autopilot baseline and separate scoped CloudShell grant), constrained by the
  unchanged verifier boundary. Access Analyzer found no issues with either the
  boundary or CloudShell grant. This is not a live read or current permission.
- The first simulation batch omitted the separate CloudShell identity grant and
  therefore reported three bootstrap implicit denials. The complete intended
  policy set passed on rerun; no policy was broadened to resolve the harness error.

## Proposed next short-lived window

Restore the same reviewed non-root verifier access for at most 30 minutes,
require MFA age at most 900 seconds for every data read, and remove temporary
grants before detaching/deleting the temporary boundary at completion or failure.
Attach/read back the boundary before grants. Preserve the sign-in policy.
Do not request fresh MFA until the code and exact window are ready.

The maximum workflow is three synthetic-key probes, followed only on success by
one exact, strongly consistent, six-field projected request read. The actual
request code stays in a hidden prompt; its observation stays in a private 0700
directory/0600 file. No Scan, Query, proof/session read, repair read, database
write, Lambda invocation, invitation or customer link is allowed by this window.
No VPC, queue, application resource, access key or new recurring resource charge
is proposed. Existing bounded service usage remains usage-billed, not a dollar cap.

The complete [review artifact](fictional-a-identity-handoff-review-2026-09-06.json)
uses a simulation deadline of 21:30 UTC. It is not permission to attach an expired
policy. At action time regenerate only the deadline for the approved <=30-minute
window, verify unchanged scope, and validate it. The user must authorize restoring
the temporary IAM window; their customer-A designation alone is not that grant.

After observing the exact identity, reconcile it privately with the confirmed
fictional-A designation and prepare the immutable enabled approval/redemption
release and exact-version operator test. No guessed hash or email match. Do not
start a five-minute pairing request before the hidden verifier input is ready.

Hosted customer linking, owned-repair access, official Alexa+ linking/testing,
replacement video and final Devpost submission remain incomplete. No application
code or live AWS permissions were changed by this checkpoint.
