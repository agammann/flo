# One-request private identity-observation handoff

> Update after the initial preparation: see
> [the temporary-window result](pairing-verifier-window-2026-09-06.md).
> CloudShell opened as the operator, but the verifier stopped before private
> input. The temporary grants were removed and cleanup verified. The current
> local verifier checks the exact non-root ARN, runs up to three synthetic-key
> probes first, and has fixed-vocabulary failure diagnostics. Its offline suite
> now contains 13 passing tests. The older preparation notes below are historical,
> not evidence of a successful live request or current IAM grants.

## Scope and current status

The owner approved one request-only verification test after reporting the hosted
signed-in/unlinked message. This does not authorize approval, invitations,
customer linking, new IAM grants, public submission, or video publication.

Prepared `scripts/verify-private-pairing-request.py` and its offline regression
tests. The existing CloudShell UI currently reports both an ended terminal
session and an AWS sign-out. No pairing request has been created and no request
record, customer identity, session or secret has been read in this increment.
Do not start the five-minute pairing request until the private input is ready.

The CloudFormation metadata read confirmed EnrollmentRequests still resolves to
`flo-customer-enrollment-state-EnrollmentRequests-1DISWL19S1ZRK` in us-west-2.
This is a container/configuration check, not a read of its records.

## Verifier behavior

- Linux/CloudShell interactive TTY only; refuses arguments, pipes and Windows.
- Checks the AWS account using STS before prompting. This is administrative
  read-only evidence capture, not the MFA-protected approval-operator test.
- Reads one code via hidden terminal input; echo fallback is an error.
- Hashes the canonical 32-byte code; never saves or prints the raw code.
- Issues one strongly consistent GetItem against only that exact hash key in
  the fixed request table. No Scan, Query, mutation, Lambda invocation, login,
  or retry. It never searches for the newest request or reads unrelated users.
- Requests only id, identityKey, purpose, status, expiresAt and ttl. It excludes
  the entire proof object, including Amazon subject and session key/revision.
- Requires a pending fictional-pairing request, a well-formed fingerprint,
  valid remaining lifetime of at most five minutes, and matching TTL.
- Saves only the projected observation and explicit non-authorization markers
  in a new random `/tmp/flo-request-evidence-*` directory (0700), with an
  exclusively created observation.json (0600, no symlink following).
- Prints only a generic result and private file path. Failures suppress input,
  provider and filesystem details and do not automatically retry.

The fingerprint is server-recorded identity correlation, not independently
verified repair ownership. This file is not an approval designation and cannot
authorize a link. The existing separately approved fictional-A assignment must
be reconciled with the exact observed identity through the reviewed process.
Never copy the private observation into chat, GitHub, or public evidence.

## Interactive sequence after AWS reconnects

1. Upload the reviewed nonsecret verifier source into the existing CloudShell
   environment. Check its SHA-256 against local source. Do not install packages
   or widen IAM automatically if prerequisites or permissions are missing.
2. Run `python3 verify-private-pairing-request.py` with no arguments. Wait for
   `PRIVATE INPUT READY` and the hidden `Pairing code` prompt. Do not paste at
   an ordinary shell prompt, or into chat.
3. In the same browser session already signed in to Flo, open `/pairing`, check
   the request consent, and click Create a private pairing request **once**.
4. Copy that code before switching tabs (visibility loss clears the display),
   paste into the waiting hidden CloudShell prompt, and press Enter. Do not
   take a screenshot while the code is visible. Clear the clipboard afterward.
5. Read only the sanitized result and file path. Do not display observation.json.
   A failed/uncertain request must expire; do not create another automatically.
6. Let this request expire. No approval, invitation, redemption or link occurs.
   DynamoDB physical TTL removal is asynchronous; expiry is enforced in code.
7. Preserve the private observation only for the separately reviewed designation
   step. Validate its exact path before any eventual cleanup. Public evidence
   records booleans, time and test scope, not identity or request fingerprints.

Temporary CloudShell storage is not durable. Loss of the file does not authorize
guessing a fingerprint, reviving an expired request, or scanning customer state.

## Verification completed locally

Seven unittest cases passed with no skips in the existing isolated Linux Docker
validator image `96708ef9c58f`, network disabled, read-only container/root and
source mount, no credentials passed, and temporary in-memory `/tmp` storage.
Cases cover canonical code validation, expiry and TTL rejection, wrong request,
wrong purpose/state/extra sensitive fields, one exact projected read, no retry,
non-authorization output, and actual POSIX directory/file permissions.

This is not a successful live GetItem or customer enrollment result. AWS sign-in
and the private handoff remain pending. No CloudFormation or IAM changes were
made by this preparation.
