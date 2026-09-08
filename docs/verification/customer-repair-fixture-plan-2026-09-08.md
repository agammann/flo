# Two-record hosted repair fixture plan — September 8, 2026

**REVIEW ONLY. No records written, no customer-B link, no IAM change, no deployment.**

## Exact target and data

Account `114599789754`, region `us-west-2`, existing stack `flo-customer-staging`, logical table `CustomerRepairs`, physical table `flo-customer-staging-CustomerRepairs-1TU01CXBBGKYE`.

The adjacent [JSON plan](customer-repair-fixture-plan-2026-09-08.json) specifies exactly two repair projections:

| Owner partition | Repair | Vehicle label | Status | Schedule | Estimate |
| --- | --- | --- | --- | --- | --- |
| `customer#staging-customer-a` | `1842` | Fictional 2019 Ford F-150 A (staging test) | diagnosis | not scheduled | not prepared |
| `customer#staging-customer-b` | `2842` | Fictional customer B vehicle (isolation test) | diagnosis | not scheduled | not prepared |

These are static fictional customer-read projections, not live shop work orders or synchronized copies of the local simulator. The shared repair number 1842 does not establish synchronization. There are no VINs, customer contacts, prices, internal shop costs, real appointment promises or payment state. B is a separate fictional owner partition, not a second Amazon account registration or customer link.

## Read-only preflight

At `2026-09-08T06:44:48.353871+00:00`:

- CloudFormation resolved the existing repair table above. DynamoDB reported `ACTIVE`, `PAY_PER_REQUEST`, with string partition/sort keys `pk` and `sk`.
- The deployed approval version-4 designation identified `staging-customer-a`. A strongly consistent, projected read of the corresponding trusted link confirmed the same customer ID and `active=true`. The Amazon subject, identity hash and other private designation fields were not emitted or saved in this plan.
- Strongly consistent COUNT queries found zero records in each proposed A/B repair partition, with no additional page reported. This is not a statement that the entire table is empty.
- No secret value was fetched. All AWS operations were reads.

Recheck the exact identity, table, active A link and both item keys immediately before any future write. This snapshot is not a reservation. If a target item already exists, stop for review rather than overwriting or adopting it.

## Local validation of the exact plan

The JSON plan SHA-256 is `2768c5bcd12324e289cc769d05227af09a3998bb18ae0c7d3d1b5a2de70275a0`.

`scripts/customer-repair-fixture-plan.test.mjs` passed both tests: strict projection/schema and key binding checks, then the existing HTTP/MCP implementation with a read-only SDK-command fake. That offline flow checked A-only listing, A retrieval, identical B/unknown repair denial, absent A estimate, identical B/unknown estimate denial, and rejection before storage access for missing and synthetic service-only credentials. No real AWS client or network was used by these tests. They do not prove the proposed transaction has executed or replace the live checks below.

The entire Node script suite passed with 91 total tests: 85 passed, six existing POSIX-only Windows skips, zero failures. Targeted ESLint passed. These three new local files are review artifacts; no new commit, push, GitHub Actions result or cloud write is claimed for this plan.

## Proposed write, only after approval

Use one `TransactWriteItems` call containing exactly two `Put` actions in the existing repair table. Each action must require `attribute_not_exists(pk) AND attribute_not_exists(sk)` and return no existing item on condition failure. The operation is atomic: either both records are inserted or neither is. See the [AWS transaction API](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html).

Use a single recorded transaction token for this logical operation. Do not automatically retry an uncertain result or generate a new token; first read the two exact keys and compare them to the reviewed records. Never use BatchWriteItem, unconditional PutItem, a table reset, or customer-link insertion as a substitute.

This is a proposed administrative fixture write, not an enrollment approval. Do not reattach the expired operator approval grant or extend its window. Check the available execution identity before writing; if new IAM permissions are needed, review them separately. No auth/session/link/enrollment/audit table is to be modified.

Existing on-demand table storage and requests, and normal HTTP/Lambda/logging during verification, can incur usage charges. No new provisioned resource, KMS key or network component is proposed. No claim of zero cost or an account-wide dollar cap is made.

## Bounded verification after insertion

1. Strongly read the two exact keys and compare the full records; record sanitized pass/fail results. Confirm neither write was partial.
2. In the already linked real customer-A session, run `List my repairs`: exactly repair 1842 is expected; no B label or repair 2842 may appear.
3. Run `Show repair 1842`: expect A's fictional vehicle and diagnosis, without a scheduled time.
4. Run `Show repair 2842` and `Show repair 9999`: both must return the same unavailable response and reveal no B data. Verify that the relevant MCP read actually ran, not only the frontend text.
5. Run `Show estimate 1842`: expect `ESTIMATE_NOT_READY`, not an invented total. Request the estimate for 2842 and 9999: both must return the same repair-unavailable response, without revealing whether B has an estimate.
6. Sign out and verify the customer data route rejects unauthenticated access. Send a separate credential-free request with a synthetic service-credential marker: it must not grant customer access. Do not expose live AWS credentials or customer cookies in recorded test output.
7. Report hosted observations separately from existing local tests for expired credentials, reassignment, concurrency and other cases. Do not claim a second real Amazon account was tested or that every authorization scenario is proven by this one session.

No orders, approvals, messages, estimates, bookings or other customer mutations are included in these read tests. The fixture write itself does not complete official Alexa+ account linking or certification.

## Retention and recovery

The proposed two fictional projections would remain for the staging demo; there is no automatic cleanup, TTL or rollback in this plan. Their static state must be labeled accurately in recordings. A later removal requires approval and conditional deletes matching these exact original records, stopping if either record has changed. Never delete a whole table, customer partition, link or audit history to clean up this test.

Approval of this plan would authorize only these two inserts and the bounded read/denial checks above. Video publication, Devpost submission, customer-B linking and changes to application permissions remain excluded.
