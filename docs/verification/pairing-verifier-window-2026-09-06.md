# Temporary verifier window: stopped safely, cleanup verified

## Result

The owner approved a 30-minute limited-permission window, up to three
synthetic-key read probes, then one exact private request observation. The
window was applied with expiry 2026-09-06T18:42:00Z and removed early after the
verifier stopped before the private-input prompt. This is **not** a successful
live request verification or completed customer enrollment.

## What was verified

- Fresh IAM preflight: exact operator ID/ARN, only SignInLocalDevelopmentAccess,
  no inline grants, groups, or boundary; temporary names did not exist.
- Final boundary and CloudShell grant: Access Analyzer returned zero findings.
  Five fresh simulations allowed the intended read and explicitly denied
  missing MFA, missing projection, proof access, and the expired window.
- Boundary attached and read back before either grant. Both grants matched the
  reviewed documents on readback. No permissions were broadened to troubleshoot.
- CloudShell initially reported CreateEnvironment AccessDenied. CloudTrail
  confirmed two failures in us-west-2. The attached-principal simulation allowed
  the operation, and a later refresh opened the operator's regional shell.
  Propagation is a plausible explanation, not an independently proven cause.
- Uploaded nonsecret verifier hash matched local source:
  69256a8fea038da79a666b928d89454a7b99e4a3379930c815320d14ce8ebd15.
- One execution printed only the generic STOP message, with no probe PASS and
  no private-input prompt. It could have attempted zero or one synthetic reads;
  the suppressed stage prevents a more precise claim. No data retry occurred.
- SDK imports were checked separately. A diagnostic print quoting mistake was
  corrected without AWS calls. A separate STS read confirmed the exact non-root
  operator; no credentials or user data were displayed.

## Session evidence and limitation

CloudTrail GetCallerIdentity events at 18:14:01Z and 18:14:54Z identify an
MFA-authenticated operator session created at 17:51:59Z. Its age exceeded the
900-second data boundary. This is consistent with the failed attempt, but the
original generic STOP does not prove the exact DynamoDB rejection reason.
Management-event history is not evidence of DynamoDB data-event coverage.

## Cleanup

Deleted both temporary inline grants first and verified no inline policies
remained. Only then removed the boundary and deleted the temporary managed
policy. Final IAM reads verified no boundary, no groups, no temporary policy,
and only the original SignInLocalDevelopmentAccess attachment. Existing Flo
application resources, data, and policies were not deleted or changed.

No real pairing request, observation file, approval, invitation, redemption, or
customer link was created by this attempt. No video publication or submission.
The uploaded nonsecret script and public CloudShell environment were not deleted.

## Local follow-up, not re-executed in AWS

Added fixed-vocabulary stage/error diagnostics that omit raw provider messages,
credentials, pairing codes, request keys, and fingerprints. The changed source
has not been uploaded or executed in AWS. Thirteen offline Python tests passed
in isolated Linux Docker with network disabled, including diagnostic redaction
and a main-path assertion that the first denied probe never prompts or retries.
Six local policy-generator tests also passed.

Next attempt requires a fresh operator console sign-in with MFA, a new reviewed
time window, source/hash synchronization, and bounded probes before creating a
real request. Keep the 15-minute MFA rule. Do not use root or infer repair
ownership from Amazon sign-in. Approval/linking and release remain separate.
