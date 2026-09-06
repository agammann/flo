# Request-only template validation — September 6, 2026

Historical bytes: the subsequent function-publication correction has a new hash
and [fresh validation/change-set evidence](enrollment-request-only-changeset-2026-09-06.md).
This report remains the exact earlier gate-only validation, not the current hash.

Your template has **0 errors, 0 warnings, 0 info messages** from cfn-lint.
Your template has **3 failing Guard policies, comprising 12 failed properties**.
Guard also reports 19 passing and 12 skipped policies. Skipped does not mean pass.

## Exact input and isolated environment

- Template: `infra/aws/customer-enrollment/runtime.template.json`, 50,576 bytes.
- SHA-256: `fac003ae5504e69fe185416c53e2b1cf3c9251500228f24f4fd153a693e44ce6`.
- Docker image: `flo-enrollment-validator:local`, ID
  `sha256:96708ef9c58f9210b7aaa9e0fddccd8371cbdcdfbd5cea202bfdc58d49fd6d90`.
- cfn-lint 1.52.1, cfn-guard 3.2.1; target region us-west-2.
- AWS rules registry revision `7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`.
- All 33 selected rule-file hashes match the earlier runtime validation exactly.
  Groups: IAM, Lambda, CloudWatch, API Gateway V2, all-resources, CloudFormation.
- Containers used `--rm --network none --read-only`. Only the nonsecret template
  was mounted read-only for validation. No AWS credentials, installation, network,
  cloud API call, application invocation, or deployment occurred.
- Final container inventory by validator-image ancestor was empty.

## Findings and treatment

The failed rule/resource/property signatures match the previous review exactly;
no new failure was introduced by the separate redemption gate. Raw Guard status
is FAIL and its nonzero host process result is preserved, not suppressed.

| Rule | Exact property / affected resource properties | Treatment |
| --- | --- | --- |
| CLOUDWATCH_LOG_GROUP_ENCRYPTED | `KmsKeyId`: RequestLogs (Guard L:521), RedemptionLogs (L:931), ApprovalLogs (L:1312) | Preserve the approved staging default-encryption treatment. A separately managed log key would require adding `KmsKeyId` plus reviewed key policy and cost; none was added. This does not imply plaintext logs. |
| LAMBDA_DLQ_CHECK | `DeadLetterConfig.TargetArn`: RequestFunction (Guard L:534), RedemptionFunction (L:944), ApprovalFunction (L:1325) | Preserve the approved synchronous-flow exception. Revisit if asynchronous invocation is added; then review a suitable queue/destination and permissions. |
| LAMBDA_INSIDE_VPC | `VpcConfig.SecurityGroupIds` and `VpcConfig.SubnetIds`: the same three function properties | Preserve the approved no-customer-VPC design. Add reviewed subnet/security-group configuration only if network requirements change. |

Line labels above are verbatim Guard locations; the JSON evidence includes full
resource paths, messages and remediation text. None of these exceptions is a
claim of raw policy compliance. No queue, VPC, or new KMS key was provisioned.

The template does not own the existing API stage, so
`API_GWV2_ACCESS_LOGS_ENABLED` remains skipped. That setting requires a separate
live read-back. The source template is below CloudFormation's inline byte limit,
but has little headroom; recalculate the submitted byte size before a change set.

## Additional checks and next boundary

All six template tests passed again, including eight gate combinations, exact
generator parity, unchanged generated IAM baselines, default-off controls and
numeric version references. `git diff --check` passed; Git emitted only normal
Windows line-ending conversion notices. The template bytes were not modified
during this validation.

This completes the approved local validation step. A review-only AWS change set
and CloudFormation pre-deployment event checks remain next; no such plan was
created or executed in this turn. Reuse the existing narrow policy treatments,
but review actual resource/version changes and costs before enabling the
request-only stage. Approval and redemption must remain off for that stage.
No customer identity or designation was fabricated or provisioned. Devpost and
replacement-video publication remain paused.

See [raw validation evidence](enrollment-request-only-validation-2026-09-06.json)
and [the request-only plan](enrollment-request-only-plan-2026-09-06.md).
