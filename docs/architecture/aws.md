# AWS deployment architecture

Flo has one intentionally narrow live AWS integration and a larger future deployment design. Keeping those states separate prevents planned services from being described as implemented.

## Verified live integration

The September 4, 2026 [deployment verification](../verification/aws-protection-2026-09-04.md) records `flo-bedrock-narrator` reaching `UPDATE_COMPLETE` in `us-west-2`. Its Node.js Lambda function invokes Amazon Bedrock through Converse with `amazon.nova-lite-v1:0`. Tests recorded successful signed narration and rejected unsigned and invalid signed requests. This is dated evidence, not a fresh account audit.

The simulator sends only the task label, option count, and sanitized quality tier. It does not send customer, vehicle, work-order, price, supplier, part-number, or free-form technician data. Bedrock does not rank or choose parts and does not calculate or mutate any business state. Both Lambda and the simulator enforce an 8–160 character, at-most-16-word response containing no digits, price marker, line breaks, or common Markdown delimiters. The simulator records the call as `AWS · amazon_bedrock_narration` and falls back to deterministic narration on failure. Lambda platform and redacted error logs flow to CloudWatch Logs through the basic execution role; the deployment guide sets a seven-day retention policy.

The function role restricts model invocation to the configured ARN. The deployed API Gateway route uses `AWS_IAM`; the former public Function URL/build-marker approach is obsolete. Server-side callers sign with authorized AWS credentials. A retained DynamoDB allowance is atomically reserved before each model attempt and fails closed if missing or exhausted. The recorded initialization allowed 100 attempts and verification left 99 at that time; this is not a current balance. Seven-day log retention and best-effort throttling complement this limit, not an account-wide dollar cap. The customer preview makes no AWS calls.

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

The current in-memory business stores can later use DynamoDB and AgentCore Memory. DynamoDB is already used only for the narrator allowance; AgentCore and Secrets Manager are not deployed in the recorded implementation. The HTTP adapters provide a replacement boundary for authenticated providers. Alexa+ customer OAuth/account linking is separate from AWS SigV4 caller authentication.

## Deployment gates

Before calling an AWS deployment complete, verify the runtime endpoint, authenticated and anonymous access expectations, one successful and one rejected confirmation flow, persistence across process restart, CloudWatch redaction, Secrets Manager use, and a clean demo reset in a non-production namespace.
