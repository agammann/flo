# Devpost submission draft

> Release status: working custom simulations and the separate AWS-hosted Login with Amazon website are described below. The original 2:41 video is stale and must be replaced; its current visibility is not reverified by this draft. Do not submit the old video as proof of the corrected build. Official Alexa+ account linking, certification and MCP App packaging remain unclaimed. This file is a draft, not evidence that the Devpost form is populated or submitted.

> September 5 local addendum: a separate, read-only vehicle-owner preview now supports owned repair status and customer-price estimate review through three MCP tools. It has not been pushed or added to the existing video. The original shop workflow alone does not address Alexa+'s consumer-eligibility policy. See [the certification tracker](../alexa-plus-certification-plan.md); reconcile this draft and the video before any final submission. This document is not evidence that the Devpost form is complete.

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

The IAM-protected `flo-bedrock-narrator` stack has recorded successful signed Bedrock narration and rejected unsigned/invalid requests. Its retained DynamoDB allowance reserves model attempts atomically. Seven-day log retention and best-effort API Gateway throttling complement that model-call limit, which is not an account-wide dollar cap. Historical allowance read-backs are not a current remaining-balance claim. Simulator hosts need their own authorized AWS identity and otherwise retain deterministic fallback. This implemented Bedrock integration provides AWS Builder evidence.

A separate customer staging website is deployed through CloudFormation using Lambda, API Gateway, DynamoDB for encrypted auth/session state and separate customer-link/repair projections, and Secrets Manager for private runtime configuration. Login with Amazon authenticates the person; only a trusted shop mapping can authorize repair access. The owner reported successful real sign-in/sign-out and the authenticated-unlinked page was inspected. New private fictional-customer enrollment services are locally tested, not deployed. Actual hosted linked-customer isolation tests remain incomplete. AgentCore and durable shop-workflow state remain future work; website login is not Alexa+ account linking.

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
- Automated regression coverage for permissions, fitment-data completeness, immutable approval/SKU binding, cross-job approval isolation, supplier-response validation, single-flight confirmations, cancelled-order retry safety, rollback, end-to-end flow and MCP transport. Consult the latest test run for counts rather than treating this draft as a CI report.

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

Demo video: https://youtu.be/ZjROvjL2smo

Reviewed English captions: [`docs/demo/flo-demo.en.vtt`](../demo/flo-demo.en.vtt)

## Technologies used

TypeScript, Node.js, pnpm workspaces, Model Context Protocol TypeScript SDK, MCP `2025-11-25`, Streamable HTTP, Zod, Express, Node test runner, HTML, CSS, browser speech recognition, Docker, AWS CloudFormation, AWS Lambda, AWS IAM, Amazon Bedrock Converse API, Amazon Nova Lite, and Amazon CloudWatch Logs.

Also used: DynamoDB for the finite narrator model-attempt allowance, not business-state persistence.

Also implemented for the separate customer website: Login with Amazon, AWS Secrets Manager and durable DynamoDB auth/session storage. Planned but not claimed as deployed: Bedrock AgentCore, private fictional-customer enrollment and durable shop-workflow state.
