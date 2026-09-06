# Request-only KMS deployment and hosted success

September 6, 2026 UTC. **Approved change deployed and one hosted request succeeded.**

Executed the exact reviewed change set
`flo-request-dynamodb-kms-review-20260906T193507Z` at 19:40:51 UTC.
CloudFormation reports UPDATE_COMPLETE. The request boundary is now version v5,
updated at 19:40:55 UTC, and its full document matches the reviewed policy.
The request execution role still uses that boundary. No other resource change
was in the approved plan. All three existing published Lambda versions remain 3.

## Hosted verification

The expired website session was refreshed through the ordinary Login with Amazon
flow. Flo then displayed signed-in/unlinked status, with Sign out available and
repair access blocked. This was a website session refresh, not AWS MFA or Alexa+
account linking.

Exactly one Create a private pairing request click occurred at 19:43:12.063 UTC.
The page displayed:

> Request created. Wait for independent operator verification; repair access is still blocked.

A correctly shaped private request code and five-minute expiry were displayed.
The code was redacted from tool output and was not stored in chat, repository,
deployment evidence or the clipboard. It was not sent to an operator. No approval,
invitation, redemption, customer mapping or repair-data read was performed.
Expiry is server enforced; this test does not authorize a replacement request.

In the bounded 19:43:10–19:43:25 UTC log interval, the API access log contains one
HTTP 200 event with latency 1,213 ms. The request Lambda version 3 ran successfully
for 1,196.178 ms. Gateway logs intentionally omit routes/payloads/credentials;
correlation is by this bounded interval plus request-function activity and the
visible browser result. The log query auto-paginated completely. Lambda platform
success alone is not treated as proof of application success.

## Rejected access and final state

The bounded credential-free hosted script passed all 12 checks after deployment:
homepage, pairing assets, privacy and terms; sessionless access 401; missing Origin
403; wrong content type 415; invalid request schema 400; absent redemption route
404; unconfigured official Alexa authorization 401. Security cache/content headers
also matched. Those probes created no authenticated pairing request.

Live function readback confirms request enrollment true, private approval false,
and redemption enrollment false. The existing ownership controls are unchanged.
No temporary operator grant or permissions boundary was added in this increment.
The AWS connector's administrative identity is not proof of operator authority.

The earlier [review and tests](request-dynamodb-kms-review-2026-09-06.md) apply to
the deployed policy; this increment did not change application source or rerun the
full application suite. No fresh GitHub Actions or Compose launch is claimed.

## Next work, still gated

The request-service 503 is resolved for this hosted test. End-to-end customer
linking is not complete: separately review the approval/redemption services'
DynamoDB KMS permissions, then validate the independently verified fictional
customer designation and live allowed/rejected approval/redemption paths. Do not
reuse an expired pairing code or infer ownership from Amazon sign-in.

No new billable resources were added. Existing usage charges still apply and no
hard dollar cap is claimed. Video publication and Devpost submission remain paused.

[Machine-readable deployment and test evidence](request-dynamodb-kms-deployment-2026-09-06.json).
