# CLI reauthorization did not establish a fresh MFA session — 2026-09-06

The owner approved a new browser login followed immediately by the same capped
disabled-version test and cleanup. CLI login completed and STS again identified
the exact intended IAM user. The temporary boundary was created, read back and
attached before the unchanged invocation baseline. Setup verification completed
at 16:51:50 UTC, before the original 18:00 UTC deadline.

The one actual operator DryRun was explicitly denied by the permission boundary.
There was no retry or function execution. The temporary grant was removed first,
then its boundary attachment and policy. At 16:52:50 UTC, live IAM read-back
confirmed only SignInLocalDevelopmentAccess remained: no inline policies,
boundary, group membership, or temporary policy object. No application settings,
customer mappings or routes changed.

CloudTrail's operator GetCallerIdentity event at 16:51:08 UTC still recorded
session creation at **16:26:31 UTC** and mfaAuthenticated=true. The new CLI
authorization did not establish new session creation metadata in the credential
used for the test. This is not evidence of a successful fresh-MFA test. The
specific IAM condition responsible for the generic explicit-deny response is
not disclosed, and CloudTrail metadata is not proof of IAM condition-key values.

Do not continue the same login/retest loop. First establish whether the browser
actually required a new MFA challenge, distinguish browser authentication from
CLI authorization, and verify a new session timestamp before granting temporary
invocation permission. Any targeted local logout/login and repeat live grant
requires confirmation. Never clear unrelated profiles/browser sessions, relax
MFA conditions, or silently extend the invocation deadline.

The user supplied a callback URL containing an authorization code. It was not
replayed, copied into commands, or saved to repository evidence; the existing
CLI listener had already completed its own flow.

[Sanitized AWS execution and cleanup evidence](operator-reauthorization-test-2026-09-06.json).
Publication and submission remain paused.
