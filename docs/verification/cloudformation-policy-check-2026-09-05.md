# Narrator CloudFormation policy check — September 5, 2026

Historical baseline: the later source remediation and owner-approved exception decisions are recorded in [the remediation report](aws-policy-remediation-2026-09-05.md). Preserve the results below as evidence for the original template hash, not the current source.

Your template has **8 violations under the selected AWS Guard rules**. This is a static policy-check result, not eight proven exploitable vulnerabilities or an account-wide compliance assessment. No application resources, IAM permissions, live retention settings or concurrency settings were changed by validation. Deployment remains gated.

## Exact input and tooling

- Template: `infra/aws/bedrock-narrator/template.yaml`, 9,250 bytes, SHA-256 `50d078065a8206933e45ae49e36e4a32d102443d1cfb6d38cf92c37d064fca69`.
- cfn-lint 1.56.0, region `us-west-2`: JSON `[]`, exit 0.
- CloudFormation Guard 3.2.1 installed in an owner-approved isolated CloudShell temporary directory. The official Linux release archive matched its GitHub release digest: `8c66efb19c63e6c2bf26b9a41bbcf2f85baa8a937b01d350940194faaf64cf1d`.
- [AWS Guard Rules Registry](https://github.com/aws-cloudformation/aws-guard-rules-registry/tree/7f7340c26ae5d5e8874651dbffeb12e0e9f505b6), commit `7f7340c26ae5d5e8874651dbffeb12e0e9f505b6`.
- Selected all 39 readable top-level `.guard` files in `rules/aws/{api_gateway_v2,cloudwatch,dynamodb,iam,lambda}`. This is a service-relevant subset, not a named compliance framework or every registry rule. Guard emitted 36 rule results: **8 FAIL, 16 PASS, 12 not applicable**; exit 19, no stderr.
- Command shape: `cfn-guard validate --rules <the 39 selected files> --data template.yaml --output-format json --structured --show-summary none --type CFNTemplate`.
- The template hash was checked again after validation and was unchanged. No suppressions or policy-driven edits were applied to obtain a passing result.
- Complete structured output is in the temporary CloudShell session at `/tmp/flo-cfn-d8K7rv/guard-results.json`, SHA-256 `c2db0a4e35275503fb20a80afa7a80ade49746e821bb52922d40a7108a41299f`. The rule-file list and stderr are alongside it. Temporary files are not durable release evidence; preserve/export them before the environment expires. This report records the observed results locally.

## Operational controls to resolve before narrator deployment

### API_GWV2_ACCESS_LOGS_ENABLED

`NarratorStage` (`AWS::ApiGatewayV2::Stage`) lacks `Properties.AccessLogSettings`. Recommend access logging to a separately retained, short-retention log group. Review log content, destination permissions and cost before applying. Do not include authorization headers, request bodies or customer identity in the format.

Proposed property fragment only; the referenced destination is not implemented:

```yaml
AccessLogSettings:
  DestinationArn: !GetAtt NarratorAccessLogGroup.Arn # Provision/review a finite-retention destination first.
  Format: '{"requestId":"$context.requestId","status":"$context.status","latency":"$context.responseLatency"}' # Minimal operational data, no payloads or credentials.
```

### LAMBDA_CONCURRENCY_CHECK

`NarratorFunction` (`AWS::Lambda::Function`) lacks `Properties.ReservedConcurrentExecutions`. Recommend evaluating a small positive concurrency limit, but first check the account quota, current workload and impact on other functions. Do not set zero merely to satisfy Guard: zero stops invocation. AWS requires capacity to remain unreserved, so the proposed value may require a quota increase. [AWS reserved concurrency documentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html).

```yaml
ReservedConcurrentExecutions: 2 # Proposal only: verify quota and workload, then obtain approval before applying.
```

The existing API rate/burst limits and allowance code are separate controls. None is an account-wide hard dollar cap.

## Encryption and recovery policy decisions

### CLOUDWATCH_LOG_GROUP_ENCRYPTED

`NarratorLogGroup` (`AWS::Logs::LogGroup`) lacks `Properties.KmsKeyId`. This rule requires an explicitly associated KMS key. It does **not** prove plaintext logs: CloudWatch Logs encrypts all log groups at rest by default. Decide whether customer-managed key control is required; account for key policy, key lifecycle and cost. [AWS log encryption documentation](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/encrypt-log-data-kms.html).

```yaml
KmsKeyId: !GetAtt ReviewedLogKey.Arn # Only if explicit KMS policy is adopted; provision and review the key first.
```

### DYNAMODB_TABLE_ENCRYPTED_KMS

`NarrationAllowance` (`AWS::DynamoDB::Table`) already has `SSESpecification.SSEEnabled: true` and passes `DYNAMODB_TABLE_MUST_BE_ENCRYPTED`. The stricter rule fails for missing `SSEType` and `KMSMasterKeyId`. Decide whether to adopt explicit key configuration; do not describe this as an unencrypted table.

```yaml
SSESpecification:
  SSEEnabled: true # Existing encryption stays enabled.
  SSEType: KMS # Make the selected encryption type explicit if adopting this policy.
  KMSMasterKeyId: !GetAtt ReviewedAllowanceKey.Arn # Review key ownership, access and lifecycle before provisioning.
```

### DYNAMODB_PITR_ENABLED

`NarrationAllowance` lacks `PointInTimeRecoverySpecification.PointInTimeRecoveryEnabled`. Backup/recovery is a production reliability decision with a cost consequence. A recovery procedure must not restore an old, larger allowance and silently enable additional model calls. Keep recovery operator-controlled and reconcile consumed allowance before re-enabling invocation.

```yaml
PointInTimeRecoverySpecification:
  PointInTimeRecoveryEnabled: true # If approved: adds recovery capability, not permission to reset the spending allowance.
```

## Governance and workload-specific policies

### IAM_NO_INLINE_POLICY_CHECK

`NarratorRole` (`AWS::IAM::Role`) has `Properties.Policies`. This rule prohibits inline policies; it does not identify excessive actions in the current inline policy. If the project adopts that governance requirement, move the exact reviewed document into `AWS::IAM::ManagedPolicy`, reference it from `ManagedPolicyArns`, and remove the inline `Policies` property without broadening access. Review the attachment migration before deployment.

```yaml
ManagedPolicyArns:
  - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole # Existing attachment; separately review its logging scope.
  - !Ref ReviewedNarrationPolicy # Proposed managed-policy resource must preserve the existing least-privilege document.
# Remove Policies only after the replacement attachment has been reviewed.
```

Passing wildcard checks does not prove least privilege for every permission: this static scan does not expand AWS-managed policy attachments or evaluate the live account's other policies.

### LAMBDA_DLQ_CHECK

`NarratorFunction` lacks `DeadLetterConfig.TargetArn`. The demonstrated API Gateway path is synchronous; Lambda dead-letter queues concern asynchronous invocation failures. Recommend a documented exception for this synchronous-only path rather than an unused queue. If asynchronous use is added, review the destination, permissions, sensitive payload handling and cost. [AWS asynchronous failure records](https://docs.aws.amazon.com/lambda/latest/dg/invocation-async-retain-records.html).

```yaml
DeadLetterConfig:
  TargetArn: !GetAtt ReviewedFailureQueue.Arn # Only for a reviewed asynchronous workflow; not a fix for synchronous API failures.
```

### LAMBDA_INSIDE_VPC

`NarratorFunction` lacks `VpcConfig.SecurityGroupIds` and `VpcConfig.SubnetIds`. This is a VPC-placement policy, not proof that the IAM-protected API is unauthenticated. Decide whether network isolation is needed before adding VPC networking, routes and service connectivity; do not incur endpoint/NAT costs simply to turn the rule green.

```yaml
VpcConfig:
  SecurityGroupIds: [!Ref ReviewedNarratorSecurityGroup] # Only after the network threat model and egress rules are approved.
  SubnetIds: [!Ref ReviewedPrivateSubnet] # Must have reviewed connectivity to the required AWS services.
```

## Passing controls and remaining gates

The finite log retention, DynamoDB encryption-enabled and on-demand billing rules passed, as did the applicable inline IAM wildcard/admin/trust checks and Lambda permission/public-access checks. Not-applicable results were chiefly IAM user/standalone-policy and CloudWatch alarm rules; they must not be counted as passes.

Next: resolve the operational findings and record owner-reviewed policy exceptions or approved changes; rerun schema and policy checks on the final source. Then inspect the existing log group's import requirements, create/review the appropriate change set, retrieve pre-deployment validation results, and obtain explicit execution confirmation. Do not delete an existing log group to bypass an import collision. No stack import or update has been attempted by this check.
