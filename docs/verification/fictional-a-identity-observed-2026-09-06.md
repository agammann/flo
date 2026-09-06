# Fictional customer A identity handoff — live success

September 6, 2026. **The one-request private identity observation succeeded.**
No approval, invitation or customer link was created.

The owner had explicitly designated their Amazon account for fictional customer A
only and approved a <=30-minute read-only operator window. The temporary boundary
and two grants were attached/read back at 21:06:28 UTC, expiring at 21:35 UTC.
The owner then completed fresh MFA. The verifier independently required the exact
non-root operator ARN; the administrative connector was not used to read the row.

The CloudShell source hash matched the tested diagnostic verifier. One execution
passed all three actual AWS probes: projected synthetic-key GetItem allowed with
no item, unprojected read denied, and proof-field read denied. It reached the
hidden private-input prompt. Successful live data authorization is separate from
the owner's MFA report and the earlier simulation evidence.

Flo's customer session had expired. The existing Login with Amazon consent flow
was refreshed, visibly restoring the signed-in/unlinked message and Sign out.
Exactly one pairing request was created. The UI showed its pending status and
14:16:04 Pacific expiry; no second request or retry was made. The code was held
privately and entered only in the waiting hidden verifier prompt, never in shell
arguments/history, chat output or public artifacts.

The verifier reported the exact pending request and a well-formed server-recorded
identity fingerprint. Its projection excluded proof and raw Amazon subject/session
fields. The observation was preserved in a newly created owner-only CloudShell
home directory, with a 0600 file, after checking source ownership, permissions,
link count and absence of a file symlink. Its contents were not displayed. The
private location is tracked outside version control; this is not durable backup
or an already-provisioned approval designation.

At 21:12:18 UTC cleanup verified: both temporary inline grants were removed first,
then the matching boundary detached and temporary managed policy deleted. Only
SignInLocalDevelopmentAccess remains; no groups, inline grants or boundary remain.
The expected NoSuchEntity response confirms temporary-policy removal. Application
resources and customer state were not altered by cleanup.

## What this closes and what remains

The previously blocked live identity-observation step is complete. Do not ask the
owner again to designate fictional A, repeat an observation without need, use an
expired pairing request, or treat login as proof of real repair ownership.

Next: privately reconcile the observed identity with the confirmed fictional-A
assignment; prepare a finite, deployment-controlled designation and immutable
enabled private approval/redemption release; review exact resource/permission
changes and a bounded stateful test plan. Customer B, real repairs and arbitrary
operator-supplied customer IDs stay excluded. Enabled hosted pairing, customer
isolation/replay/logout checks, official Alexa+ checks and release/video work are
still incomplete. No video was published or Devpost submission made here.

[Sanitized window, result and cleanup evidence](fictional-a-read-window-2026-09-06.json).
