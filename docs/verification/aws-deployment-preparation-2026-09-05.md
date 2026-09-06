# AWS deployment preparation — September 5, 2026

This report records preparation and the completed preservation-only log import, not deployment of the broader hardening update or a release. Submission and video publication remain paused.

Later same-day checkpoint: [the fresh infrastructure review](aws-hardening-review-2026-09-05.md) records restored validation tooling, both template checks, separately approved customer policy exceptions, and a review-only narrator UPDATE change set. The applied quota was still 10; no hardening update was executed. The old temporary tooling directory referenced below is no longer available.

## Approved quota change

The owner explicitly approved replacing the earlier **102** Lambda concurrency request with **1,001** in `us-west-2`. The account was verified before submission. Existing Service Quotas request history was empty.

`request-service-quota-increase` accepted:

- Service: `lambda`; quota: `L-B99A9384`.
- Desired value: **1001**.
- Request ID: `9aee223c1a5b44e9a2d68fd7b3108dae0Lq1YWJJ`.
- Initial returned status: **PENDING**; `CaseId: null`.
- Immediately afterward, `get-account-settings` still reported `ConcurrentExecutions=10`, `UnreservedConcurrentExecutions=10`.

A subsequent `get-requested-service-quota-change` returned **CASE_OPENED**, linked to AWS Support case **178864400000075**. This is the automatically linked quota case, distinct from the earlier manually created case below. No approved/applied quota increase was observed.

Existing Support case **178864359700865** was updated, with the saved correspondence verified in the console at September 5, 14:34:05 PDT. The update explicitly supersedes the old 102 request, references the new request ID, keeps Flo's intended reservation at **2**, and requests no workload changes or paid support-plan upgrade. This is not evidence of quota approval or application.

## Existing narrator inventory

Before planning an import:

- Stack `flo-bedrock-narrator`: **UPDATE_COMPLETE** in `us-west-2`.
- Eight existing logical resources: `NarrationAllowance`, `NarratorApi`, `NarratorApiPermission`, `NarratorFunction`, `NarratorIntegration`, `NarratorRole`, `NarratorRoute`, `NarratorStage`.
- Existing `/aws/lambda/flo-bedrock-narrator` log group is outside this stack, has **seven-day retention**, class **STANDARD**, and no explicit customer-managed KMS association. Absence of that association does not mean the logs are unencrypted.
- Stack tags: empty. Parameters are `ModelId`, `ThrottlingRateLimit`, `ThrottlingBurstLimit` and are preserved via `UsePreviousValue=true` during import planning.
- No allowance reset or model invocation was performed.

## Preservation-only log import

The import template is derived from the live `get-template` response, not the local hardening template. It adds only:

```yaml
  NarratorLogGroup:
    Type: AWS::Logs::LogGroup
    DeletionPolicy: Retain
    UpdateReplacePolicy: Retain
    Properties:
      LogGroupName: /aws/lambda/flo-bedrock-narrator
      RetentionInDays: 7
```

A first candidate converted the deployed YAML through the cfn-lint decoder into JSON. Although a parsed-object comparison passed, CloudFormation rejected it as modifying five existing resource definitions during import. No change set was executed. The corrected candidate instead inserts the log-group block into the original YAML, verifying that removing the addition reproduces the original text exactly. This avoids relying on parser normalization for import identity.

Corrected template: `/tmp/flo-cfn-d8K7rv/import-log-group-exact.yaml`, SHA-256 **`2c36a1f08c41d8807cefb775a019ab3a45310147c6dd36d57f398b32ad92cc1b`**.

- cfn-lint 1.56.0, `us-west-2`: `[]`, exit **0**.
- Guard 3.2.1 with the same pinned 39-file selection: **16 PASS, 8 FAIL, 12 not applicable**, exit **19**, empty stderr.
- Raw findings are the unchanged baseline: API access logging, explicit log/table KMS, PITR, inline IAM, reserved concurrency, DLQ and VPC. This import step does not implement the later hardening changes or hide these findings. It only puts existing log-group ownership under CloudFormation while preserving settings.
- The separate hardened source remains SHA-256 `4d5b66e5d4db46fff2aac2d0ddb5971ee58bcd0988c6595d0b51c84d7dd34d71`; its six fixes and two accepted exceptions are documented in [the remediation report](aws-policy-remediation-2026-09-05.md).

### Reviewed change set and approved execution

- Name: `flo-import-log-exact-20260905T213934Z`.
- ARN: `arn:aws:cloudformation:us-west-2:114599789754:changeSet/flo-import-log-exact-20260905T213934Z/7dfb9ded-ac9b-43a4-b94b-4eae4287e9c1`.
- CloudFormation returned **CREATE_COMPLETE**, execution status **AVAILABLE**.
- Exactly one `ResourceChange`: action **Import**, logical ID `NarratorLogGroup`, physical ID `/aws/lambda/flo-bedrock-narrator`, type `AWS::Logs::LogGroup`, replacement `null`. No other resource changes are listed.
- `describe-events` scoped to that ARN returned two stack events ending in **SUCCEEDED** at `2026-09-05T21:39:38.256Z`, with no `VALIDATION_ERROR` events. These are CloudFormation pre-deployment results, not proof of runtime hardening or completion of the import.
- The owner subsequently approved execution of this exact import-only plan. Import puts the existing log group under CloudFormation management, preserves seven-day retention/default encryption and its current name, and adds retain-on-delete/replacement declarations. It does not create new compute, keys, database capacity or model allowance.

After re-verifying account `114599789754`, the exact one-resource change list and `AVAILABLE` status, the approved change set was executed with client request token `flo-import-log-exact-20260905-approved`. Live read-back verified:

- Stack status **IMPORT_COMPLETE**, with operation start `2026-09-05T21:46:03.050Z`.
- Change-set execution status **EXECUTE_COMPLETE**; `describe-events` reports the enclosing `UPDATE_STACK` operation **SUCCEEDED** at `2026-09-05T21:46:07.477Z`.
- `describe-events` records `NarratorLogGroup` **IMPORT_COMPLETE** at `2026-09-05T21:46:04.903Z`, followed by CloudFormation's stack-tag application step. The resource detail subsequently reports **UPDATE_COMPLETE** at `2026-09-05T21:46:06.494Z`, attached to the correct stack with physical ID `/aws/lambda/flo-bedrock-narrator`.
- Log group remains **seven-day retention**, **STANDARD** class, with no explicit customer-managed KMS association, unchanged from preflight.
- Live `get-template` SHA-256 exactly matches the approved import template: `2c36a1f08c41d8807cefb775a019ab3a45310147c6dd36d57f398b32ad92cc1b`.
- Lambda remains **Active**. Before/after code hash is `FTNFquFpit4yD+e0vCJXDHrE9q+3iyePAl7KdWNrdGc=` and last-modified timestamp remains `2026-09-05T04:57:16.000+0000`.
- API route authorization remains **AWS_IAM**.
- Quota request remains **CASE_OPENED**, case `178864400000075`; applied concurrency and unreserved concurrency both remain **10**.

No model request, allowance reset, new KMS key, backup configuration change or broader hardening deployment was performed. The first rejected serialization candidate was not executed. The other eight resource definitions remain unchanged in the byte-identical approved template; the broader local hardening source still requires a separately reviewed update. These control-plane checks are not an end-to-end application test.

## Privacy identity confirmation

The owner confirmed **Alexander Ammann** as the legal operator and confirmed that **xyes47314@gmail.com** is monitored and receives mail. The privacy draft and hosting decision record were updated. This is owner confirmation, not an independent email-delivery test. No Login with Amazon profile, secret, HTTPS customer deployment or public privacy page was created in this step.

## Remaining sequence

1. **Completed:** review, explicit execution approval, import, and live verification of `IMPORT_COMPLETE`, ownership and preserved settings.
2. Require an applied regional quota sufficient for Flo's reservation; a pending request is insufficient.
3. Prepare and review the separate hardening update, including IAM/KMS permissions, resource replacement flags, retained-resource costs and the allowance-preservation runbook. Execute only after explicit approval.
4. Verify actual log retention/encryption, table PITR, policy attachment, reservation and accepted/rejected AWS calls. Do not reset the allowance to create test capacity.
5. Finish the separate customer staging implementation: Lambda HTTP boundary and durable login/session state before public hosting. Verify isolated customer-to-repair mapping and real LWA sign-in. Website login is not Alexa+ account linking.
6. Complete applicable official Alexa+ tooling/testing, reconcile release claims and replace/review the demo. Submit/publish only after final authorization and verified outcomes.
