# Enrollment KMS boundary correction — review only

2026-09-06. **Prepared and validated, not executed.** This record follows the
[startup failure](enrollment-runtime-deployment-2026-09-06.md), not a successful
runtime test. Source changes are local on base commit
`86139591cdc6f0c10b89055dba078788101e14f7`; no push or fresh CI run occurred here.

## Why this exact correction

Read-only CloudTrail inspection found Encrypt and CreateGrant events for all
three enrollment functions. Each uses `alias/aws/lambda` and the exact unqualified
function ARN in `aws:lambda:FunctionArn`. The existing managed key policy grants
same-account decryption with that context; Lambda also created context-constrained
grants. The denied Decrypt events omit request parameters, so they do not by
themselves establish the context. The successful encryption/grant events do.

The verified key is `arn:aws:kms:us-west-2:114599789754:key/57e62ad6-a638-40c9-9af6-df42a6418968`.
It is AWS-managed and enabled. No key or grant was created or modified in this turn.

The maximum-permission boundary now:

1. Exempts only `kms:Decrypt` from the blanket unlisted-action deny.
2. Allows it only on the supplied exact key ARN, with the exact caller account
   and this role's own function ARN as encryption context.
3. Explicitly denies other keys.
4. Separately denies a wrong or absent caller account and a wrong or absent
   function context. Separate deny statements preserve OR semantics.

All other KMS operations remain denied. This does not grant broad decryption,
repair reads, secret retrieval, operator access, or customer linking. It is a
ciphertext/key/context restriction, not proof that an API caller is a customer.
An authorized caller able to obtain ciphertext matching this exact key/context
is not additionally restricted by `kms:ViaService`; that key is deliberately not
assumed for Lambda startup. The role's generated application baseline remains
unchanged. Existing AWS-managed key authorization supplies the other side of
the permission decision, subject to successful post-update live verification.

Full resolved boundary documents and AWS simulation results are in
[machine-readable evidence](enrollment-kms-boundary-review-2026-09-06.json).
The reusable generator requires the new `lambdaEnvironmentKeyArn` configuration
field. CloudFormation takes the nonsecret `LambdaEnvironmentKeyArn` parameter;
it does not set or change a function's `KMSKeyArn` property.

References: [Lambda environment encryption](https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars-encryption.html),
[KMS encryption-context least privilege](https://docs.aws.amazon.com/kms/latest/developerguide/least-privilege.html),
[KMS service authorization reference](https://servicereference.us-east-1.amazonaws.com/v1/kms/kms.json).

## Verification

- Full regression/build: 148 passed, zero failed, three Windows skips (151 total).
- Typecheck: all 13 workspace configurations passed.
- Lint: passed with zero allowed warnings.
- Boundary/template tests: 21 passed, zero failed, including all 105 table/action
  combinations and new missing-context, wrong-account, wrong-key, other-function,
  qualified-function and unrelated-KMS-action cases.
- AWS `SimulateCustomPolicy`: 57 individual decisions matched expectations.
  The deliberately permissive test identity policy exists only as simulator
  input and was never attached. These tests establish the proposed maximum
  permission boundary, not a successful live function or effective key grant.
- Existing isolated Docker validator, network disabled and no AWS credentials:
  cfn-lint 1.52.1 reports zero errors, warnings or information messages.
- Guard 3.2.1 with the previously pinned AWS rules: three failing policies,
  19 passing, 12 skipped; the same 12 failed property checks for missing explicit
  log KMS keys, DLQ and VPC. Previously approved scoped exceptions remain;
  no findings were suppressed and this is not an all-Guard-pass claim.

## Exact AWS review plan

Account `114599789754`, region `us-west-2`, stack `flo-customer-enrollment`.

Change set: `flo-enrollment-kms-boundary-review-20260906`.

ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-enrollment-kms-boundary-review-20260906/2a850bb7-1ada-454e-b148-de768b4a232a`.

`Status=CREATE_COMPLETE`, `ExecutionStatus=AVAILABLE`.
`DescribeEvents` reports successful change-set creation and no validation errors.

| Resource | Action | Replacement |
| --- | --- | --- |
| ApprovalBoundary | Modify PolicyDocument | False |
| RedemptionBoundary | Modify PolicyDocument | False |
| RequestBoundary | Modify PolicyDocument | False |

No other resource changes are listed. Existing parameters, code artifacts,
published versions and ReleaseId are preserved. All three enable flags remain
false. The template-to-live semantic comparison independently found only these
three resource modifications plus the new nonsecret key-ARN parameter.

This plan adds no billed resource, new key, database, VPC, queue, public route or
concurrency allocation. Existing resources retain their usage-dependent costs;
this correction is not a spending cap.

## Next approval boundary

Execution requires a separate explicit approval. After execution, recheck the
three policies, unchanged enable flags and routes, then perform bounded synthetic
synchronous checks against the existing numeric versions. Stop on unexpected
results. Account for connector retries as well as explicit Invoke calls.

No Lambda Invoke, real KMS Decrypt, table record read/write, customer mapping,
Devpost submission or video publication occurred in this turn. Log delivery and
the earlier Logs policy-simulator discrepancy remain unresolved and must not be
reported as fixed by this KMS-only change.
