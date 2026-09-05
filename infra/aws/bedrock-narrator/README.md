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

Set the returned value as `BEDROCK_NARRATOR_URL` in the simulator deployment environment. The demo endpoint accepts only `POST /narrate`, the fixed non-secret build marker, and a tightly validated, non-personal payload. The marker is routing metadata, **not authentication**: the HTTP API remains publicly invokable by anyone who knows it. Do not publish the URL. API Gateway caps the demo at one request per second with a burst of two by default; `ThrottlingRateLimit` and `ThrottlingBurstLimit` can lower those limits at deployment. For a shared or production deployment, require authenticated ingress such as IAM-authorized API Gateway with a SigV4-signed server-side caller.

The Lambda role has only basic logging permission and `bedrock:InvokeModel` for the configured foundation-model ARN. The API Gateway throttle, Lambda's eight-second timeout, 256 MB memory limit, and the sixty-token Bedrock cap form the demo's rate and per-request cost boundary. Apply account-level budgets/alarms and authenticated ingress before sharing the endpoint beyond judging.

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
