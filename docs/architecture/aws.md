# AWS deployment architecture

Flo has one intentionally narrow live AWS integration and a larger future deployment design. Keeping those states separate prevents planned services from being described as implemented.

## Verified live integration

On September 4, 2026, the CloudFormation stack `flo-bedrock-narrator` reached `CREATE_COMPLETE` in `us-west-2`. Its Node.js Lambda function invokes Amazon Bedrock through the Converse API with `amazon.nova-lite-v1:0`. A live request returned a contract-valid qualitative narration lead; a request with the wrong build header returned HTTP 403.

The simulator sends only the task label, option count, and sanitized quality tier. It does not send customer, vehicle, work-order, price, supplier, part-number, or free-form technician data. Bedrock does not rank or choose parts and does not calculate or mutate any business state. Both Lambda and the simulator enforce an 8–160 character, at-most-16-word response containing no digits, price marker, line breaks, or common Markdown delimiters. The simulator records the call as `AWS · amazon_bedrock_narration` and falls back to deterministic narration on failure. Lambda platform and redacted error logs flow to CloudWatch Logs through the basic execution role; the deployment guide sets a seven-day retention policy.

The function role grants `bedrock:InvokeModel` only for the configured foundation-model ARN. The current Lambda Function URL deliberately uses `AuthType: NONE` solely so the local hackathon simulator can demonstrate the live integration without distributing AWS credentials. Its fixed build header is not authentication, and the endpoint URL is not committed. A shared or production deployment must use `AWS_IAM` with a SigV4-signed server-side caller or an authenticated, rate-limited gateway.

## Future deployment target

| AWS service | Flo responsibility |
| --- | --- |
| Amazon Bedrock | Live for one concise qualitative comparison lead; planning and reference disambiguation are future expansions |
| AgentCore Runtime | Host the orchestrating agent and its request lifecycle |
| AgentCore Memory | Short-term conversation context and long-term job references, separated by user/shop namespace |
| AgentCore Gateway | Govern calls from the agent to Flo tools and future external adapters |
| AgentCore Identity | Associate authenticated principals with Flo roles where supported by the selected integration |
| DynamoDB | Work orders, estimates, approvals, purchase orders, schedules, audits, idempotency records, and confirmation records |
| CloudWatch | Structured tool latency, result status, work-order reference, approval transitions, and transaction metrics |
| Secrets Manager | Provider credentials and signing material |

The current in-memory stores satisfy interfaces that can later be implemented with DynamoDB and AgentCore Memory. The HTTP adapters remain unchanged when mock services are replaced by authenticated provider endpoints. AgentCore, DynamoDB, and Secrets Manager are not active in the current demo.

## Deployment gates

Before calling an AWS deployment complete, verify the runtime endpoint, authenticated and anonymous access expectations, one successful and one rejected confirmation flow, persistence across process restart, CloudWatch redaction, Secrets Manager use, and a clean demo reset in a non-production namespace.
