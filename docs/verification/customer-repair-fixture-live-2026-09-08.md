# Hosted fictional repair isolation — September 8, 2026

## Completed scope

The owner approved the [exact two-record plan](customer-repair-fixture-plan-2026-09-08.json), SHA-256 `2768c5bcd12324e289cc769d05227af09a3998bb18ae0c7d3d1b5a2de70275a0`, for insertion and bounded live read/denial checks. The original plan remains unchanged as the reviewed input; this report records its subsequent execution.

Preflight at 06:49:50 UTC resolved the repair table from CloudFormation, confirmed the existing active trusted customer-A link, and strongly read both exact item keys as absent. The connected AWS integration identified as account-root. It performed the explicitly approved administrative fixture transaction; it was not substituted for the separately verified non-root enrollment operator. No IAM permission or customer-link change was made.

One `TransactWriteItems` call inserted the two reviewed projections into `flo-customer-staging-CustomerRepairs-1TU01CXBBGKYE` in account `114599789754`, region `us-west-2`. Both Put actions used `attribute_not_exists(pk) AND attribute_not_exists(sk)`. The single logical transaction token was `flo-fixtures-20260908-0650`; no retry or replacement token was used. At 06:50:28 UTC, strong GetItem read-back matched both full records exactly. DynamoDB returned four write-capacity units consumed. This is not a dollar-cost or account-wide spending-cap claim.

The two static fictional records remain for the staging demo. Their estimates and schedule fields remain null. No contact information, VIN, price, appointment or real repair claim was added. The hosted records are not synchronized with the local shop simulator.

## Live browser and HTTP checks

The real hosted customer-A browser session ran these commands. Results below describe observed rendered responses and tool indicators; byte-for-byte network response equality was not captured for the authenticated browser requests.

| Check | Observed result |
| --- | --- |
| `List my repairs` | Exactly repair 1842, Fictional 2019 Ford F-150 A (staging test), diagnosis, null schedule; `list_my_repairs` displayed. No B data. |
| Session expiration during next request | The page removed customer controls and required sign-in. No repair result was displayed. A real Login with Amazon renewal restored the linked session. This observation does not substitute for captured expired-token HTTP replay evidence. |
| `Show repair 1842` after renewal | A's fictional vehicle, diagnosis, and no scheduled service time; `get_my_repair` displayed. |
| `Show repair 2842` | Repair unavailable for the account, no repair data; `get_my_repair` displayed. |
| `Show repair 9999` | Same visible denial and tool indicator as 2842. |
| `Show estimate 1842` | Shop has not prepared an estimate; no price invented; `get_my_estimate` displayed. |
| `Show estimate 2842` | Repair unavailable for the account; `get_my_estimate` displayed. |
| `Show estimate 9999` | Same visible denial and tool indicator as 2842. |
| Sign out | Customer controls/results removed; page confirmed signed out of Flo. Amazon itself remains signed in. |
| Separate POST with no customer session | Actual HTTP 401, `SIGN_IN_REQUIRED`, no repair data. |
| Separate POST with synthetic service-only Bearer marker and `x-flo-customer-id` | Actual HTTP 401, `SIGN_IN_REQUIRED`, no repair data. No live AWS credentials were transmitted to the customer route. |

The two direct rejection probes used the correct hosted Origin and the same `List my repairs` command. They were not blocked merely for a missing/wrong Origin. They establish rejection of unauthenticated and synthetic service-marker access, not a complete official Alexa+ service/user authorization test.

## Boundaries and final state

- Customer B was not linked to an Amazon account. No second real Amazon account was used.
- No enrollment approval, operator grant, IAM policy, Lambda configuration or CloudFormation resource was changed in this turn.
- No estimate, customer approval, order, payment, notification or scheduling transaction was performed.
- Final browser state is signed out of Flo. The trusted customer-A link and both approved fictional projections remain.
- The original operator approval window was not extended or reattached.
- Local fixture checks use a simulated database; the live observations above are separate evidence.
- This closes the approved hosted A-read/B-denial fixture check. It does not establish successful hosted estimate totals, synchronization with shop state, all session-race/revocation scenarios, official Alexa+ account linking, certification, or video/Devpost release.

No password, AWS credential, session cookie, Amazon subject, private identity hash, pairing code or invitation is included in this report. No new source push or GitHub Actions run is claimed by this local evidence file.
