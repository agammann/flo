# Devpost submission draft

> Evidence status: this draft describes the verified local implementation and the live Amazon Bedrock narration adapter. Replace the video placeholder only after public playback is verified. The official Alexa+ add-on connection and MCP App package remain explicitly unclaimed.

## Project name

Flo

## Tagline

An open source MCP operating layer for hands-free service operations.

## Inspiration

Technicians should not have to stop a repair, remove gloves, and search across work-order, inventory, supplier, customer, and scheduling systems. Voice is especially valuable when the operator’s hands and attention are occupied—but only if voice can execute a safe, structured workflow rather than act as another chat window.

## What it does

Flo coordinates a service job from diagnosis to schedule. In the automotive demonstration, a technician opens work order 1842 for a 2019 Ford F-150, records an alternator diagnosis, finds deterministically compatible options from three simulated suppliers, compares price, warranty, delivery, and margin, creates an exact estimate, requests customer approval, resumes the job later by asking about “the Ford,” and prepares a part purchase with Bay 2 scheduling. The final transaction requires a separate confirmation and is revalidated server-side.

## How we built it

Flo is a strict-TypeScript pnpm monorepo. A Streamable HTTP MCP server exposes 25 production tools; development mode adds three clearly labeled demo controls for approval simulation, deterministic demo time, and reset. Thin MCP handlers call an orchestrator, which uses HTTP adapters for four independent simulated services. Zod validates tool input, provider output, and domain state. Deterministic engines own compatibility, ranking, pricing, permissions, approvals, schedule conflicts, idempotency, and confirmation. Job memory stores recent work-order and selected-part context separately from service truth.

The automated suite starts real local HTTP services and runs the complete workflow. A separate transport test uses the official TypeScript MCP client, negotiates protocol `2025-11-25`, lists tools, and invokes the live `get_work_order` tool.

## Alexa+ integration

Flo’s MCP surface, voice-first workflow, and custom visual Alexa+ simulation are implemented. This satisfies the hackathon’s documented simulated-experience option while also demonstrating the stronger self-hosted MCP path locally. The official Alexa+ add-on connection and MCP App package are pending select-partner environment validation. The project will not describe the custom browser simulator as an official Amazon simulator or claim Alexa device execution until that test is recorded.

## MCP architecture

Alexa+ or the simulator calls the Flo MCP endpoint. The MCP server derives the actor, validates input, invokes the orchestrator, and returns structured results. All important work-order, parts, estimate, approval, purchase, and scheduling state is read or mutated through tools. `prepare_purchase_and_schedule` returns a short-lived confirmation summary; only `confirm_transaction` can execute it.

## AWS integration

Flo uses AWS for a narrow, non-authoritative narration step. The simulator sends a minimal, non-personal payload to an AWS Lambda function deployed by CloudFormation. Lambda calls Amazon Bedrock's Converse API with Amazon Nova Lite to generate one short qualitative lead sentence before Flo appends the deterministic comparison facts. The model never chooses the part, calculates price, checks compatibility, approves a customer action, orders inventory, or schedules work. The simulator validates the sentence and falls back to deterministic narration if AWS is unavailable or violates the output contract.

The `flo-bedrock-narrator` stack was verified `CREATE_COMPLETE` in `us-west-2`; a live Bedrock invocation returned a valid response, and an invalid build header returned HTTP 403. IAM limits the function to Bedrock model invocation plus basic Lambda logging. This implemented and documented integration qualifies Flo for the AWS Builder mini challenge. AgentCore, DynamoDB, and Secrets Manager remain future architecture and are not claimed as used.

## Challenges

- Preserving useful conversational context without treating memory as operational truth.
- Calculating estimates and compatibility deterministically while still allowing flexible language.
- Enforcing approval and confirmation on the server even when a model proposes a shortcut.
- Supporting the challenge’s named MCP revision with the current TypeScript SDK and proving it in a transport-level test.

## Accomplishments

- Complete local diagnosis-to-order-and-schedule workflow.
- 25 production MCP tools over Streamable HTTP, plus three development-only demo controls.
- Three supplier behaviors and partial-failure-ready parallel search.
- Exact integer-cent estimates and deterministic fitment explanations.
- Role checks, approval state machine, single-use confirmation, idempotency, schedule conflict detection, and audit records.
- Long-term job reference resolution with explicit ambiguity errors.
- Fourteen passing automated tests, including permissions, safety failures, rollback, end-to-end, MCP transport, voice-safe fallback, and production tool-surface coverage.

## What we learned

Agentic voice products need stronger state boundaries than ordinary chat applications. The model can help interpret “the Ford” or explain why one option is preferable, but compatibility, money, availability, approval, and execution must remain inspectable and deterministic. Confirmation also needs to be a server-side protocol, not a sentence in a system prompt.

## What’s next

Package the polished visual panels as MCP App resources, evaluate a broader Bedrock planning adapter, connect AgentCore behind the existing interfaces, persist business state in DynamoDB, validate the official Alexa+ flow, and add an HVAC adapter to demonstrate industry portability.

## Open source

License: MIT

Repository: https://github.com/agammann/flo

GitHub username: `agammann`

Open Source contribution URL: https://github.com/agammann/flo

Open Source contribution description: Flo is a new MIT-licensed TypeScript project built during the hackathon. It implements a self-hosted MCP operating layer that connects conversational commands to structured service-business systems. Deterministic engines protect compatibility, pricing, permissions, approvals, idempotency, and transactional execution, while adapters make the same architecture extensible beyond automotive repair.

Demo: `[PUBLIC VIDEO URL — pending]`

## Technologies used

TypeScript, Node.js, pnpm workspaces, Model Context Protocol TypeScript SDK, MCP `2025-11-25`, Streamable HTTP, Zod, Express, Node test runner, HTML, CSS, browser speech recognition, Docker, AWS CloudFormation, AWS Lambda, AWS IAM, Amazon Bedrock Converse API, Amazon Nova Lite, and Amazon CloudWatch Logs.

Planned but not yet claimed as used: Bedrock AgentCore, DynamoDB, and Secrets Manager.
