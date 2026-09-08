# AWS deployment architecture

Flo has a narrow Bedrock narrator and a separate hosted customer application, plus a larger future deployment design. Keeping those states separate prevents planned services from being described as implemented.

## Customer staging checkpoint — September 8, 2026

The separate HTTPS customer service runs on Lambda/API Gateway, uses Secrets
Manager for private runtime configuration, and DynamoDB for auth/session state,
trusted customer links, enrollment and repair projections. CloudFormation defines
the deployment. These are not the local shop's in-memory work orders or estimates.
See the [staging deployment](../verification/customer-staging-deployment-2026-09-05.md),
[completed fictional pairing](../verification/fictional-a-pairing-completed-2026-09-08.md)
and [hosted isolation test](../verification/customer-repair-fixture-live-2026-09-08.md).

Real Login with Amazon establishes identity; separately authorized shop mapping
establishes access. One fictional A identity was paired, then tested against A/B
repair fixtures. No estimate or appointment exists in those fixtures. The hosted
customer service is read-only for repairs and is not an authenticated Alexa MCP
endpoint. This is dated verification, not a new account-wide AWS audit.

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

The current in-memory shop business stores can later use DynamoDB and AgentCore Memory. The table above describes that future orchestration target: it does not supersede the deployed customer storage/Secrets Manager checkpoint above. AgentCore remains undeployed. The HTTP adapters provide a replacement boundary for authenticated providers. Alexa+ customer OAuth/account linking is separate from both website Login with Amazon and AWS SigV4 caller authentication.

## Deployment gates

Before calling an AWS deployment complete, verify the runtime endpoint, authenticated and anonymous access expectations, one successful and one rejected confirmation flow, persistence across process restart, CloudWatch redaction, Secrets Manager use, and a clean demo reset in a non-production namespace.
