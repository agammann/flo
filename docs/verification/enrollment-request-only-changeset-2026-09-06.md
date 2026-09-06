# Request-only AWS change set — pre-execution review

Subsequent checkpoint: the owner approved execution, the corrected update is
complete, and the obsolete plan was removed. See the
[deployment verification](enrollment-request-only-deployment-2026-09-06.md).
The following records the original review before that approval.

## Reviewed plan

Stack: `flo-customer-enrollment`, account 114599789754, us-west-2.

Corrected change set: `flo-request-only-fixed-review-20260906T1727Z`

ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-request-only-fixed-review-20260906T1727Z/c9483626-383b-4170-909c-1bf8785d0749`

At 17:27:17 UTC, CREATE_COMPLETE / AVAILABLE. DescribeEvents returned no
VALIDATION_ERROR records. GetTemplate read-back exactly matches the tested source.
No execution occurred. The administrative connector is account root; it was used
only for this deployment review, not as a substitute operator test identity.

| Proposed changes | Count and scope |
| --- | --- |
| Add API integration | One, pointing to the new exact request version |
| Add public routes | Three: GET /pairing, GET /pairing.js, POST /enrollment/request |
| Add invocation permissions | Three, each restricted to that exact API route and account |
| Modify Lambda functions without replacement | Three: reviewed release descriptions; request also gets enabled and points to the new disabled redemption version |
| Publish immutable versions | Three ReplaceAndRetain operations; existing version 2 resources retained |
| Modify request permission boundary | Only exact redemption-version reference advances; no broader capability |

No removal actions, table/bucket/key creation, VPC/DLQ, operator grant, customer
designation, customer mapping, repair mutation or existing website replacement.
Published-version replacement is expected and must not be described as no
replacements. Function objects themselves are not replaced.

Parameters: EnableEnrollment=true, PublishRoutes=true, EnableRedemption=false,
EnableApproval remains false. The existing NoEcho designation is preserved with
UsePreviousValue without retrieving or printing it. Artifacts/code hashes,
tables, secret reference and other prior parameters remain unchanged.

## Publication correction found during review

The first review-only change set `flo-request-only-review-20260906T1724Z`
attempted to republish approval and redemption using only changed Version
descriptions, without a qualifying function code/configuration update. It was not
executed and must not be executed. Recommend deleting only that obsolete change
set after approval, not its stack or retained versions.

The generator now binds the function Description and version Description to the
same reviewed release identifier. AWS lists function description as a qualifying
configuration change for version publication. A regression assertion requires
those markers to match for all three functions.
[Official Lambda version behavior](https://docs.aws.amazon.com/lambda/latest/dg/configuration-versions.html).

## Fresh validation of corrected bytes

Template SHA-256: `56c436ff30adf883708bf0192f97ebcf48db74dec5e5f82ef4e1755ee56fd2a5`;
50,871 bytes, under the 51,200-byte inline limit with only 329 bytes remaining.
Future growth requires rechecking size or separately approved S3 template upload.

cfn-lint: zero errors/warnings/info. Pinned Guard: three failing policies / 12
property findings, 19 pass, 12 skipped; exact same failed rule/resource/property
signatures. Existing default-log-encryption and synchronous no-DLQ/no-VPC scoped
treatments remain exceptions, not raw passes. The local validator used no network
or credentials. All 27 boundary/template tests and modified-script ESLint pass.
Earlier validation hashes describe earlier bytes, not this corrected source.

## Existing controls and cost exposure

Live API preflight: default throttle 2 requests/second, burst 5; access-log format
contains requestId, status and latency, not request payload or credentials.
No stage setting is changed by this plan. Existing function limits remain
256 MB, reserved concurrency 1, request timeout 20 seconds and private-function
timeouts 10 seconds. Existing log retention is seven days.

This enables an additional usage-billed surface on the existing API. It does not
add a new fixed-price KMS key, database or NAT gateway. HTTP calls/data transfer,
Lambda execution, logs and any authenticated request-table writes may incur
charges. No free-tier eligibility, monthly total or hard spending cap is claimed.
The request-only path does not call Bedrock. Existing unrelated account costs
are not measured by this review.
[API Gateway pricing](https://aws.amazon.com/api-gateway/pricing/),
[Lambda pricing](https://aws.amazon.com/lambda/pricing/).

## Proposed verification after explicit execution approval

1. Recheck change set identity, tested source, exact changes and gate values.
2. Execute only the corrected plan; wait for UPDATE_COMPLETE and inspect
   operation events if a failure occurs. Do not enable gates to resolve errors.
3. Verify all resulting exact version ARNs/code hashes: request enabled,
   redemption disabled, approval disabled. Verify request boundary pins the new
   disabled redemption version and no operator grant exists.
4. Verify exactly three new routes and no redemption/approval route; retain the
   original default route, sign-in and repair access controls.
5. Make at most 12 credential-free HTTP checks of page/script, existing site,
   rejected request inputs and absent redemption route. No customer session,
   invitation, successful pairing request or stateful application write in this
   initial check. Stop on unexpected access; do not claim ownership verification.
6. Prompt the owner for hosted sign-in and separately reviewed private request
   verification. Amazon identity plus the owner's independent fictional-A
   assignment is needed before configuring approval. Never ask for secrets in chat.

Rollback after successful public exposure requires a reviewed disabling update,
not manual record deletion, allowance refill or function deletion. Any actual
customer-link test and revocation/cleanup procedure require their own reviewed
scope. Video and Devpost publication stay paused for separate final approval.

See [full sanitized evidence](enrollment-request-only-changeset-2026-09-06.json).
