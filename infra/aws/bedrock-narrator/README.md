# Amazon Bedrock narration adapter

This stack gives Flo a narrow, meaningful AWS integration for the AWS Builder mini challenge. A Lambda function invokes Amazon Bedrock through the Converse API to produce one short qualitative narration lead for the parts-comparison response.

The model does **not** choose a part, calculate money, determine compatibility, read inventory, approve a transaction, place an order, or schedule work. Those facts remain deterministic. The simulator appends the exact server-calculated supplier, cost, warranty, and customer price after the optional Bedrock lead. If AWS is unavailable or the output violates the no-numbers contract, Flo falls back to its deterministic narration.

## Deploy

Use an AWS account with access to the selected Bedrock model. From AWS CloudShell in `us-west-2`:

```bash
aws cloudformation deploy \
  --region us-west-2 \
  --stack-name flo-bedrock-narrator \
  --template-file infra/aws/bedrock-narrator/template.yaml \
  --capabilities CAPABILITY_IAM
```

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

The retained, deletion-protected table `flo-narration-allowance` deliberately starts empty. The function cannot create, reset or delete the allowance record; until an operator initializes it, valid requests fail closed. After explicit approval for up to 100 lifetime model attempts, initialize exactly once:

```bash
aws dynamodb put-item --region us-west-2 \
  --table-name flo-narration-allowance \
  --item '{"id":{"S":"flo-lifetime-v1"},"schemaVersion":{"N":"1"},"remaining":{"N":"100"},"used":{"N":"0"}}' \
  --condition-expression 'attribute_not_exists(id)'
```

Do not remove the condition or reset an existing row. A conditional-write failure means the allowance already exists; read it with `get-item --consistent-read` instead. Every model attempt first atomically decrements `remaining`. Missing, exhausted, invalid or unavailable ledger state prevents calling Bedrock. Model SDK retries are disabled. Failed, timed-out and invalid-output attempts are never refunded because billing may already have occurred. Simulator reset, Lambda cold starts and ordinary stack updates do not refill the allowance. Exhaustion returns 429 and the simulator keeps its deterministic comparison response.

This is a maximum of 100 future Bedrock attempts after initialization, not an account-wide dollar spending cap. API Gateway, Lambda, DynamoDB, logs, storage and rejected traffic may still incur charges. Do not reset or replace the retained ledger without a newly reviewed allowance. Authenticated ingress and account-level cost alarms remain necessary.

The Lambda role has basic logging permission, `bedrock:InvokeModel` only for the configured model ARN, and `dynamodb:UpdateItem` only for its allowance table and fixed key. It cannot initialize or refill the allowance. Lambda has an eight-second timeout and 256 MB memory limit; Bedrock output is capped at sixty tokens with a fixed-size validated input. Apply account-level budgets/alarms before broader sharing.

## Verify

Run a parts comparison and open the Agent execution trace. A successful call is labeled:

```text
AWS · amazon_bedrock_narration
```

CloudWatch receives only Lambda platform logs and a redacted failure message. No customer, vehicle, work-order, price, supplier, part number, or free-form technician text is sent to Bedrock. Set an explicit retention period after deployment (the example keeps seven days):

```bash
aws logs put-retention-policy \
  --region us-west-2 \
  --log-group-name /aws/lambda/flo-bedrock-narrator \
  --retention-in-days 7
```

## Remove

```bash
aws cloudformation delete-stack --region us-west-2 --stack-name flo-bedrock-narrator
```
