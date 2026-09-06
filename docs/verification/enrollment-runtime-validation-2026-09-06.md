# Enrollment runtime: isolated CloudFormation validation

**Schema PASS; raw Guard FAIL; not deployed.** This fulfills the owner's explicit approval to validate the new runtime template only. No AWS credentials, network access, AWS API calls, application records, IAM attachments or resource changes were involved.

## Exact input and tools

- Source commit: `ac91cf0f74ae064be334a7270316184b1b772f15`.
- Template: [runtime.template.json](../../infra/aws/customer-enrollment/runtime.template.json), unchanged, 44,152 bytes, 27 resource entries.
- SHA-256: `a037959dc25edbb0063fdff78a03bb0815c512b308ecd5408c47c3a58fc56dde`.
- Existing local Docker image: `flo-enrollment-validator:local`, previously verified ID `sha256:96708ef9c58f9210b7aaa9e0fddccd8371cbdcdfbd5cea202bfdc58d49fd6d90`.
- Container: `--rm --network none --read-only`; only the nonsecret template and validation script were mounted read-only. No installation or image rebuild.
- cfn-lint 1.52.1; cfn-guard 3.2.1; region us-west-2.
- AWS Guard registry commit `7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`.
- Selected all 33 top-level `.guard` files in `iam`, `lambda`, `cloudwatch`, `api_gateway_v2`, `all_resources`, and `aws_cloudformation`. Guard evaluated 34 policy rules; file count and rule count differ. Each selected file's SHA-256, complete commands and unsuppressed output are in [raw evidence](enrollment-runtime-validation-2026-09-06.json).

## Results

Your template has **0 errors, 0 warnings, 0 info messages** from cfn-lint (exit 0).

Your template has **3 failing Guard policies**, spanning **12 failed property checks** (exit 19). Guard also reports **19 passing** and **12 skipped** policies. Skipped means not evaluated, not passed. No rules or template properties were suppressed or altered to obtain these results.

| Policy | Affected resources / exact property | Treatment |
| --- | --- | --- |
| `CLOUDWATCH_LOG_GROUP_ENCRYPTED` | `RequestLogs` line 439, `RedemptionLogs` line 796, `ApprovalLogs` line 1124: missing `Properties.KmsKeyId` | Default CloudWatch encryption exists; this rule requires explicit KMS configuration. Preserve the prior default-encryption staging direction for review, or separately review a CMK/key policy/cost change. No key was added. |
| `LAMBDA_DLQ_CHECK` | `RequestFunction` line 452, `RedemptionFunction` line 809, `ApprovalFunction` line 1137: missing `Properties.DeadLetterConfig.TargetArn` | Owner previously directed proceeding without DLQ for the synchronous flow. Record the scoped treatment; do not add an unused queue to hide the raw finding. Reassess if asynchronous invocation is introduced. |
| `LAMBDA_INSIDE_VPC` | Same functions: missing `Properties.VpcConfig.SecurityGroupIds` and `Properties.VpcConfig.SubnetIds` | Owner previously directed proceeding without a customer VPC. Keep that design; reassess if private-network resources or network-isolation requirements are introduced. |

CloudWatch data is encrypted at rest by default; missing `KmsKeyId` is **not** evidence of plaintext logs. [Official encryption documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/encrypt-log-data-kms.html).

If explicit KMS management is chosen later, the template change starts with the following property on each log group, accompanied by separately reviewed key/service/caller permissions and costs:

```yaml
KmsKeyId: !Ref ReviewedLogKeyArn # Only after a valid key and scoped access are reviewed.
```

DLQs concern failed asynchronous invocation processing, while these application entry points use synchronous requests. [Lambda asynchronous-record documentation](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-retain-records.html). A customer VPC is for connecting Lambda to that network's resources, not a blanket requirement for every Lambda function. [Lambda VPC documentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc.html).

Passing policies include finite log retention, positive Lambda concurrency, no user-attached policies, no inline policies, and enumerated IAM/Lambda permission checks. These static checks do not prove effective least privilege. In particular, the generated baseline policies remain broad on their own and require the exact runtime boundaries.

`API_GWV2_ACCESS_LOGS_ENABLED` was **skipped** because this template does not define the existing API stage. Its actual access-log delivery and throttle settings still require independent live checks. Guard also does not resolve the separately recorded log-permission simulation discrepancy.

## Remaining deployment gates

The validation approval is complete; no need to repeat it for these unchanged bytes. A future template modification requires fresh evidence. Before execution, record the exact scoped policy treatment, resolve the log-permission discrepancy, package/verify immutable artifacts, and review the complete change set and costs. No runtime change set was created in this validation turn.

Real operator/MFA authorization, independently verified customer designation, hosted pairing/rejection tests and applicable official Alexa+ checks remain incomplete. Video publication and Devpost submission stay paused. No final-release readiness claim follows from this report.
