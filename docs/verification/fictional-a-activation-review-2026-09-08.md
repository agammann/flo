# Fictional customer-A activation change-set review — 2026-09-08

Status: **EXECUTED after separate approval.** This document preserves the pre-execution review. See [deployment verification](fictional-a-activation-deployed-2026-09-08.md) for the actual outcome and remaining test boundaries.

- Stack: `flo-customer-enrollment`, account 114599789754, us-west-2.
- Change set: `flo-fictional-a-activation-review-20260908t052523z`.
- ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-fictional-a-activation-review-20260908t052523z/294cba33-4ecc-422f-b815-bf5ae020f18c`.
- CloudFormation: CREATE_COMPLETE / AVAILABLE.
- Private designation expiry: **2026-09-08T09:25:13.430000+00:00**. Do not execute after expiry or reuse the expired prior pairing request.
- Source template SHA-256: `3ea203684f5d20da8ecacee902623de5c127a447b362a119ace6ddc132645bbc`.
- Source template exactly preserves current live resources. The added rule rejects empty/null approval designations. The reviewed parameter changes are ReleaseId, EnableApproval, EnableRedemption and the private NoEcho ApprovalDesignation.

## Exact resource changes

| Action | Resources | Effect |
| --- | --- | --- |
| Add | RedeemPairingRoute; RedeemPairingPermission | Expose POST /enrollment/redeem through the existing authenticated application checks and exact request-version permission. |
| Modify, no replacement | ApprovalFunction; RedemptionFunction; RequestFunction | Apply the fixed fictional-A designation and approval/redemption gates; update release descriptions and the exact redemption-version reference. |
| Modify, no replacement | PairingIntegration | Route existing pairing HTTP traffic to the new request version. |
| Modify, no replacement | RequestBoundary | Update only the permitted numeric redemption-version reference; no additional service/table capabilities. |
| Replace | ApprovalVersion; RedemptionVersion; RequestVersion | Publish new immutable versions. Old versions have Retain and UpdateReplacePolicy Retain. |
| Replace | PairingAssetPermission; PairingPagePermission; StartPairingPermission | Recreate three API invocation permissions for the new request version. |

Total: 2 additions, 11 modifications, of which 6 require replacement. No resource removals. No tables, keys, log groups, VPCs, DLQs or operator permissions are added, removed or replaced.

## Verification evidence

- Live stack was UPDATE_COMPLETE with EnableApproval=false and EnableRedemption=false before plan creation.
- All three deployed Lambda code SHA-256 values match the preserved pinned artifact parameters.
- Current template bytes match the previously completed cfn-lint and Guard evidence; lint had zero findings. Guard retains the documented scoped log-key/DLQ/VPC findings and is not described as passing.
- DescribeEvents, scoped to the completed change set, returned two stack events and zero VALIDATION_ERROR events.
- Full sanitized DescribeChangeSet details are in the adjacent review JSON. No identity fingerprint, request code or approval designation is included.
- This administrative plan uses AWS Core. It is not evidence of a successful non-root operator approval invocation.
- The temporary CloudShell observation-recovery policy was removed before this review. No new operator policy is part of this change set.

## Cost and security boundary

The plan reuses current compute, database, encryption and logging resources. It introduces no new customer-managed KMS keys, backup services, NAT gateways or provisioned concurrency. Existing reserved concurrency remains 1 per enrollment handler and log retention remains seven days.

Additional calls can incur Lambda request/duration, API Gateway, DynamoDB, KMS and log usage charges. This is not a hard dollar-spending cap or a guarantee of zero charges. Existing resource storage/backup/key costs continue unchanged by this plan.
Pricing references: [Lambda](https://aws.amazon.com/lambda/pricing/), [API Gateway](https://aws.amazon.com/api-gateway/pricing/).

Enabling the deployment gates does not itself create an approval or link a customer. The designation is for the owner's previously authorized fictional customer A only, not B or a real shop record. A fresh authenticated request, separately reviewed exact-version operator access, explicit approval and customer redemption remain necessary. The expiry stops new private approvals; it does not automatically disable the deployed routes or erase a subsequently created customer link.

## Observed preparation issues

The first CreateChangeSet call failed before creation because the timestamp in ReleaseId contained uppercase characters. The corrected lowercase name satisfies its allowed pattern.

AWS Core's failed-call diagnostic echoed the submitted NoEcho designation metadata in tool output. No password, login token or client secret was involved. NoEcho does not redact client/connector diagnostics. Raw diagnostic output was suppressed on the successful retry; do not copy the original tool diagnostic into public evidence.

## Next execution and test gate

Obtain explicit approval for this exact change set before ExecuteChangeSet. If the designation expires first, prepare a fresh bounded designation and a new reviewed change set; do not execute this stale plan.

After execution, verify stack completion, numeric versions, permissions, gates and unchanged data resources. Then separately review the finite exact-version non-root operator grant and perform new request/approval/redemption, customer-A-only and rejected customer-B tests. Deployment alone does not seed repairs, prove ownership, establish Alexa+ account linking, or finish certification. Video publication and Devpost submission remain paused.
