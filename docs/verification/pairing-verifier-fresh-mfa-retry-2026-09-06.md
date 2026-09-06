# Fresh-MFA verifier retry: KMS boundary denial identified

## Live result

The owner explicitly approved one new temporary window, at most three synthetic
reads, then one private request observation only after those checks pass.
The verified boundary was attached before the two grants, with expiry
2026-09-06T18:56:00Z. Access Analyzer returned no findings and five policy
simulations returned the expected allow/deny decisions.

Re-running Policy Autopilot on the diagnostic source produced the same baseline.
The existing CloudShell source was preserved under a versioned filename because
the upload service refuses overwrite. The diagnostic source uploaded successfully
and its SHA-256 matched a48d0d8eed12578cf54b2dd8157e04e04cb294689ed9e32e13a3731930c1f45d.

The single verifier execution stopped at synthetic-probes with
AccessDeniedException. Exactly one projected synthetic-key read was attempted;
neither forbidden-read probe nor the private input prompt was reached. No real
request was created or read, and no approval, invitation, or customer link occurred.

## Cause and correction to the earlier hypothesis

CloudTrail confirms the verifier's operator session was MFA-authenticated and
created at 18:21:08Z. Its GetCallerIdentity event at 18:29:25Z succeeded, so the
previous stale-session hypothesis does not explain this fresh attempt.

At 18:29:25Z, a KMS Decrypt event for the same operator failed with AccessDenied,
explicitly identifying a permissions-boundary deny of kms:Decrypt. Table metadata
confirms an ACTIVE id-partition-key table with SSE enabled and an enabled
AWS-managed KMS key. GetResourcePolicy returned PolicyNotFoundException.
Only sanitized KMS event comparisons are stored in the JSON; no ciphertext,
request code, customer identity fingerprint, or raw exception message is saved.

The boundary's deny-every-other-capability statement intentionally blocked the
Autopilot-generated KMS action, but that also blocked DynamoDB's legitimate
on-behalf-of decrypt. This is a policy design defect, not a reason to weaken MFA
or to use root for the request read. Successful GetItem simulations did not
simulate this downstream KMS authorization.

AWS documents the distinction: an AWS-managed DynamoDB key is used on behalf of
the accessing principal and its policy allows service-mediated cryptographic
operations. The default AWS-owned key has different authorization requirements.
See [DynamoDB encryption usage notes](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/encryption.usagenotes.html)
and [KMS policy evaluation](https://docs.aws.amazon.com/kms/latest/developerguide/key-policies.html).

## Cleanup verified

Both temporary inline grants were deleted first, and absence verified. Then the
boundary was detached and its temporary managed policy deleted. Final reads
confirmed only SignInLocalDevelopmentAccess, no inline policies, no boundary,
and no groups. Application resources and data were not changed.

## Review required before another attempt

Prepare a narrow boundary correction for kms:Decrypt on the observed existing
key, only through DynamoDB in us-west-2 and for the exact request-table encryption
context and account. Preserve the exact principal, finite window, fresh-MFA
data-read rule, six-field projection, no proof access, and no writes/invocations.
Explicitly reject direct KMS use, other keys/table contexts/accounts, and missing
required context. Validate policy size, Access Analyzer, local regressions, and
both DynamoDB and KMS simulations before asking to apply it.

No KMS exception has been applied. No additional data retry is authorized by
this failed attempt. The private observation and eventual approval/link tests
remain incomplete; video and submission stay paused.
