# Amazon Bedrock narration adapter

This stack gives Flo a narrow, meaningful AWS integration for the AWS Builder mini challenge. A Lambda function invokes Amazon Bedrock through the Converse API to produce one short qualitative narration lead for the parts-comparison response.

The model does **not** choose a part, calculate money, determine compatibility, read inventory, approve a transaction, place an order, or schedule work. Those facts remain deterministic. The simulator appends the exact server-calculated supplier, cost, warranty, and customer price after the optional Bedrock lead. If AWS is unavailable or the output violates the no-numbers contract, Flo falls back to its deterministic narration.

## Deploy

Latest verified status: the separately approved September 5 hardening update reached **UPDATE_COMPLETE**. Live checks verified IAM rejection, invalid-input rejection, one successful Bedrock request, fresh encrypted-log delivery and reserved concurrency 2. See [deployment evidence](../../../docs/verification/narrator-kms-deployment-2026-09-05.md). Customer staging and official Alexa+ integration are separate, incomplete steps. Future updates still require review and execution approval.

Use an AWS account with access to the selected Bedrock model. From AWS CloudShell in `us-west-2`:

**Existing-stack migration:** the template now owns `NarratorLogGroup` with seven-day retention. If `/aws/lambda/flo-bedrock-narrator` already exists outside the stack, do **not** run an ordinary update that tries to create it. First compare the deployed template and resource inventory, then create and review an **IMPORT** change set containing the unchanged existing resources plus this log group, identified by `LogGroupName`. Import does not permit unrelated resource changes; if local source differs, use a separate import-only template based on the deployed source, then a separately reviewed update. Preserve the group's actual retention during import and reconcile it to seven days afterward if necessary. Never delete the group to work around a name collision. No import or live retention change has been performed by this source patch. See [AWS resource import](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resource-import-existing-stack.html).

**Migration history, September 5:** the separately approved import-only change set first reached `IMPORT_COMPLETE`, preserving the existing log group and Lambda code. A subsequent separately approved hardening update is now deployed; see the latest evidence above. The [import report](../../../docs/verification/aws-deployment-preparation-2026-09-05.md) describes the earlier checkpoint.

```bash
aws cloudformation deploy \
  --region us-west-2 \
  --stack-name flo-bedrock-narrator \
  --template-file infra/aws/bedrock-narrator/template.yaml \
  --capabilities CAPABILITY_IAM \
  --no-execute-changeset
```

This command prepares an update for review; it does not execute it. Complete the import-only migration first if applicable. Review changes, replacement flags, IAM/KMS permissions, costs and CloudFormation pre-deployment validation (`describe-events`) and obtain explicit execution approval before applying the change set.

Read the endpoint without printing credentials:

```bash
aws cloudformation describe-stacks \
  --region us-west-2 \
  --stack-name flo-bedrock-narrator \
  --query 'Stacks[0].Outputs[?OutputKey==`NarratorEndpointUrl`].OutputValue' \
  --output text
```

Set the returned value as `BEDROCK_NARRATOR_URL` in the simulator server environment. `POST /narrate` requires AWS IAM authentication. The server signs the exact body with SigV4 using the standard AWS credential chain (SSO/profile/workload role); no AWS credentials reach the browser. Grant that server identity only `execute-api:Invoke` on the stack's `NarratorInvokeArn` output. Requests containing only the former public build marker are denied. Redirects and non-API-Gateway URLs are rejected before sending credentials. Credential resolution and HTTP execution share the 2.5-second fallback deadline.

API Gateway targets one request per second with burst two by default. AWS defines these throttles as best effort, not guaranteed ceilings. The separate persistent allowance below enforces a finite model-call limit even if the simulator forwards repeated authorized requests.

## Initialize the finite model allowance once

The retained, deletion-protected table `flo-narration-allowance` deliberately starts empty. The handler only conditionally decrements an existing record; until an operator initializes it, valid requests fail closed. After explicit approval for up to 100 lifetime model attempts, initialize exactly once:

```bash
aws dynamodb put-item --region us-west-2 \
  --table-name flo-narration-allowance \
  --item '{"id":{"S":"flo-lifetime-v1"},"schemaVersion":{"N":"1"},"remaining":{"N":"100"},"used":{"N":"0"}}' \
  --condition-expression 'attribute_not_exists(id)'
```

Do not remove the condition or reset an existing row. A conditional-write failure means the allowance already exists; read it with `get-item --consistent-read` instead. Every model attempt first atomically decrements `remaining`. Missing, exhausted, invalid or unavailable ledger state prevents calling Bedrock. Model SDK retries are disabled. Failed, timed-out and invalid-output attempts are never refunded because billing may already have occurred. Simulator reset, Lambda cold starts and ordinary stack updates do not refill the allowance. Exhaustion returns 429 and the simulator keeps its deterministic comparison response.

This is a maximum of 100 future Bedrock attempts after initialization, not an account-wide dollar spending cap. API Gateway, Lambda, DynamoDB, logs, storage and rejected traffic may still incur charges. Do not reset or replace the retained ledger without a newly reviewed allowance. Authenticated ingress and account-level cost alarms remain necessary.

The Lambda role has basic logging permission, `bedrock:InvokeModel` only for the configured model ARN, and `dynamodb:UpdateItem` only for its allowance table and fixed key. That IAM permission does not constrain update expressions: different or compromised code could initialize or refill the row. The reviewed handler's conditional decrement is the enforcement boundary, not an IAM-enforced immutable spending ledger. Lambda has an eight-second timeout and 256 MB memory limit; Bedrock output is capped at sixty tokens with a fixed-size validated input. Apply account-level budgets/alarms before broader sharing.

## Verify

Run a parts comparison and open the Agent execution trace. A successful call is labeled:

```text
AWS · amazon_bedrock_narration
```

The hardened source declares Lambda platform logs with a redacted failure message, plus API access logs containing only request ID, response status and latency. It does not log request bodies, credentials, identities, IP addresses, paths or query strings. No customer, vehicle, work-order, price, supplier, part number, or free-form technician text is sent to Bedrock. Both log groups declare seven-day retention through [`AWS::Logs::LogGroup`](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-logs-loggroup.html). These source changes are not evidence of a deployed configuration. For an older, not-yet-imported log group, the operator-approved manual equivalent is:

```bash
aws logs put-retention-policy \
  --region us-west-2 \
  --log-group-name /aws/lambda/flo-bedrock-narrator \
  --retention-in-days 7
```

## Policy hardening and deployment gates

The September 5 source revision addresses six baseline policy findings and records two narrowly scoped, owner-approved exceptions. See [verification evidence](../../../docs/verification/aws-policy-remediation-2026-09-05.md) and [exception scope](policy-exceptions.json).

- **Operational logs:** API access logs contain only the three fields above. The Lambda and API log groups use a rotating customer-managed KMS key restricted to their exact encryption-context ARNs; both groups and their key are retained on stack deletion.
- **Concurrency:** `ReservedConcurrentExecutions` is fixed at 2 in reviewed source and verified live. Changing the cap requires a source/change-set review rather than a parameter override. The final September 5 readback showed a regional quota of 1,000 and 998 unreserved units. The earlier quota of 10 no longer blocks this deployment. Do not omit the reservation or set it to zero to bypass a future quota issue.
- **Allowance encryption:** the retained DynamoDB table explicitly uses a separate rotating customer-managed key. The narrator key policy grants only `kms:Decrypt`, constrained by the account, regional DynamoDB service and exact table encryption context. The deployment identity needs the appropriate key-management permissions; application runtime permissions are not deployment permissions.
- **Recovery:** DynamoDB point-in-time recovery uses a seven-day window. [The recovery runbook](recovery.md) prohibits reconnecting an old allowance snapshot without reconciliation; unknown consumption fails closed with zero remaining allowance. Backups are not authority to grant new model calls.
- **IAM governance:** the existing narrow Bedrock/DynamoDB statements move from inline policy into an attached customer-managed policy. The fixed DynamoDB partition-key condition also rejects a missing leading-key context. The existing AWS basic logging policy remains; this change does not claim that IAM makes the allowance immutable.
- **Scoped exceptions:** no dead-letter queue for this synchronous API workflow, and no customer VPC while there are no private-network dependencies. Re-review by October 5, 2026, or before either assumption changes. IAM ingress and TLS remain required. These are accepted findings, not claims that the raw Guard rules pass.

Quota history: the initial 102 request and subsequent owner-approved 1,001 request are recorded in [deployment preparation](../../../docs/verification/aws-deployment-preparation-2026-09-05.md). At the final review, request `9aee223c1a5b44e9a2d68fd7b3108dae0Lq1YWJJ` still reported **CASE_OPENED**, while the applied quota independently read **1,000**. This does not establish approval of 1,001. No quota request was changed during this deployment.

Two customer-managed keys introduce recurring key charges and request costs; PITR and additional logs can also incur charges. AWS already encrypts these services at rest with default key management: explicit customer-managed keys strengthen key control, not previously absent encryption. Review current prices and the exact change set before enabling these resources. Retained keys and backups can continue to cost money after stack deletion. Do not disable or delete keys while retained logs or backups need them.

After a reviewed deployment, verify the API and function use the intended log groups/retention, key status and policy, table PITR, managed-policy attachment and concurrency reservation. Run one approved valid signed request and rejected unsigned/invalid requests. Verify KMS-backed allowance access with fresh function execution rather than relying solely on a warm DynamoDB key cache. Do not exhaust, reset or refill the live allowance just to test it; use isolated tests for exhaustion and restore scenarios.

## Remove

```bash
aws cloudformation delete-stack --region us-west-2 --stack-name flo-bedrock-narrator
```
