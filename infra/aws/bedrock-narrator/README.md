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
  --query 'Stacks[0].Outputs[?OutputKey==`NarratorFunctionUrl`].OutputValue' \
  --output text
```

Set the returned value as `BEDROCK_NARRATOR_URL` in the simulator deployment environment. The endpoint accepts only the fixed, non-secret build marker and a tightly validated, non-personal payload; concurrency is capped at one. For a production release, replace this hackathon boundary with IAM or OAuth authentication and remove the unauthenticated Function URL.

## Verify

Run a parts comparison and open the Agent execution trace. A successful call is labeled:

```text
AWS · amazon_bedrock_narration
```

CloudWatch retains only Lambda platform logs and a redacted failure message. No customer, vehicle, work-order, price, supplier, part number, or free-form technician text is sent to Bedrock.

## Remove

```bash
aws cloudformation delete-stack --region us-west-2 --stack-name flo-bedrock-narrator
```
