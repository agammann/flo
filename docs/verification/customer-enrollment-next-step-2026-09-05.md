# Customer enrollment: next staging verification gate

> Subsequent progress: the owner approved designating the tested Amazon account for fictional customer A. The local pairing service, HTTP wrapper and atomic-test adapter are implemented with 12 new tests; the full suite passes 113 tests. No live link was written. See [local implementation evidence and remaining durable/operator requirements](customer-enrollment-local-2026-09-05.md). The proposal below remains the hosted gate, not a deployment-complete claim.

## Confirmed before this step

The owner reported successful hosted sign-in and sign-out. A subsequent direct inspection of the open hosted browser showed the exact signed-in/unlinked message, Sign out visible, and neither sign-in prompt nor repair controls displayed. This is real UI evidence, separate from mocked provider tests. No signed-in repair API request or agent-operated logout was performed during that inspection.

## Current implementation boundary

Source review of `customer-dynamodb.ts`, `durable-customer-auth.ts`, and `customer-http.ts` confirms:

- Links bind the configured LWA client ID and server-verified Amazon subject to an explicit customer ID. Required metadata includes active state, operator, verification time and evidence reference.
- The link store has only a read interface. The website has no enrollment or link-writing endpoint.
- Session authorization revalidates Amazon identity, reads the trusted link, and checks session revision/expiry before issuing a customer principal. Unlinked identity receives CUSTOMER_NOT_LINKED.
- Repair projections are read under the authorized customer's partition and checked again for ownership.

The missing capability is a reviewed enrollment workflow, not a weaker sign-in check. Do not decrypt or inspect session records to manually extract identities, accept a caller-supplied Amazon subject as verification, or guess a customer association from email or repair numbers.

## Proposed controlled test (not provisioned or authorized by this document)

Use only fictional data and an explicitly approved owner-controlled Amazon test account. Proposed fixture identifiers are `staging-customer-a` with repair `1842`, and `staging-customer-b` with repair `2842`. Check for existing records before creating anything and never overwrite them. Labels must identify both as fictional staging records.

The owner, acting as the operator of these fictional fixtures, must explicitly designate which account may access customer A. This designation is test-data authorization, not verification of real-world repair ownership. The Amazon identity must still be bound by a trusted authenticated pairing flow; the operator must not simply type an Amazon subject into a link record.

Implement and review pairing before any hosted link write:

1. A separately authorized operator creates a short-lived, single-use invitation for the explicitly selected fictional customer after verification. The public website must not choose a customer or issue invitations by itself.
2. The intended account holder signs in through real LWA and redeems the invitation in a same-origin request. Identity comes from server-validated session state, not request fields.
3. Atomically consume the invitation and bind that identity to the authorized customer, with audit evidence and explicit conflict rejection. Expired, replayed, wrong-purpose, unauthenticated and unauthorized requests must fail without creating a link.
4. Verify that customer A's repair can be read, customer B's and unknown repairs are denied consistently, caller-supplied identity overrides are rejected, and logout/link revocation block subsequent access.

For real customers, an independently verified shop contact/process, operator authorization, recovery and unlinking must be reviewed. A user possessing a repair number, a website login or a test-data designation is not sufficient.

## Test and deployment boundaries

Build and test pairing locally before proposing any hosted endpoint, IAM or database write expansion. Show the exact AWS changes before deployment approval. The current website role's read-only customer-link permission must not be broadened casually; define narrowly scoped enrollment authority separately.

No customer fixture, mapping, invitation, IAM change or new endpoint was created in this preparation step. No secret or session data was fetched. Official Alexa+ linking remains separate. Submission and video publication remain paused.
