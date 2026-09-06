# Product feedback

This feedback covers Alexa+ documentation, the MCP TypeScript SDK, custom browser simulations and the recorded AWS narrator integration. That integration uses CloudFormation, Lambda, Bedrock, API Gateway, IAM, CloudWatch and DynamoDB for a finite model-attempt allowance. It excludes hands-on claims about official Alexa+ partner tooling/devices, AgentCore, Secrets Manager and durable business-state deployment.

## Alexa+ developer documentation and MCP Toolkit guidance

**What we used it for:** Choosing the MCP Toolkit path, defining the conversational workflow, separating voice summaries from visual comparison detail, designing confirmation-gated transactions, and checking the required transport and protocol revision.

**What worked well:** The guidance separates capabilities from Alexa's orchestration and distinguishes category contracts from custom MCP tools. The certification policy also exposed an important product gap: an exclusively internal shop workflow is not an end-consumer add-on. We are adding a genuine owner-facing preview and keeping the shop simulation separate. MCP Toolkit remains the repair-information prototype route; consumer appointment booking may overlap Category Action Local Booking and needs review with Amazon.

**What needs work:** The general Alexa developer landing page still emphasizes Alexa Skills Kit and device integrations, while the hackathon points developers toward Alexa+ MCP and Agent Skills. A single prominent route from the general Alexa page to the current Alexa+ add-on documentation would reduce ambiguity. Every sample should also state whether it was verified on a physical device, an official simulator, a local MCP client, or a custom web simulation.

**Onboarding:** The conceptual path was understandable, but official end-to-end add-on validation remains difficult without select-partner access. We could validate the documented protocol and customer experience locally, but that is not the same as proving an Alexa-hosted add-on.

**Would we build with it again?** Yes. The MCP approach fits service businesses that already have structured APIs and need Alexa+ to plan and execute across them.

## Model Context Protocol TypeScript SDK and Streamable HTTP

**What we used it for:** Hosting the Flo MCP server, registering typed tools, returning structured content, exposing the server through Streamable HTTP, and connecting both the simulator and automated transport test with the official TypeScript client.

**What worked well:** The server/client split made the integration independently testable. Thin tool handlers, Zod schemas, annotations, and structured errors supported an auditable boundary between language reasoning and deterministic business logic. A transport-level test can prove that the client negotiated `2025-11-25` and executed a real tool.

**What needs work:** Current SDK documentation emphasizes the newest protocol generation, while the hackathon names `2025-11-25` as the minimum. Discovering the stateless legacy compatibility option required reading serving guidance and package declarations. A version matrix with copyable TypeScript server and client examples would save time.

**Onboarding:** Good once the protocol-version boundary was understood. The hardest part was establishing evidence for the exact named revision, not implementing the tool calls.

**Would we build with it again?** Yes. Streamable HTTP is a practical boundary for testing and replacing simulated adapters with authenticated services later.

## Custom web simulator and browser speech recognition

**What we used it for:** Demonstrating the Alexa+ interaction model without special hardware or official partner tooling. The browser UI shows the conversation, the same structured result used for voice, visual work-order/parts/estimate/approval/schedule surfaces, and an optional MCP invocation trace. Browser speech recognition is a convenience input; typed commands remain fully supported.

**What worked well:** Judges can see the whole tool chain, and the product remains usable when microphone support is unavailable. Explicit visual Confirm and Cancel controls now mirror the spoken confirmation path.

**What needs work:** A custom browser simulation cannot prove Alexa invocation, official host context, MCP App rendering, account linking, or device behavior. A first-party local Alexa+ harness with tool traces, host context, multimodal preview, authentication testing, and certification checks would close that gap.

**Onboarding:** Straightforward because it uses ordinary web technology, but teams must label it carefully so a custom simulation is not mistaken for an official Alexa simulator.

**Would we build with it again?** Yes for development and hackathon communication, while preserving a clear path to official Alexa+ testing.

## AWS services

**What we used:** AWS CloudFormation deploys a Node.js Lambda function, IAM grants Bedrock model invocation plus basic logging, Lambda calls Amazon Bedrock's Converse API with Amazon Nova Lite, and CloudWatch Logs receives platform and redacted error logs. The function generates only one non-authoritative comparison lead; deterministic Flo code owns every part choice and operational fact.

**What worked well:** Model discovery, the compact Converse call and reproducible CloudFormation template made the narrow integration inspectable. The later IAM/SigV4 deployment recorded a valid signed response and denied unsigned calls. DynamoDB's atomic update provides a shared, finite attempt boundary across Lambda instances. A build marker is not authentication, and these controls are not an account-wide dollar cap.

**What needs work:** CloudFormation template validation did not reveal that `ReservedConcurrentExecutions: 1` would violate the account's minimum unreserved-concurrency requirement. The error appeared only during stack creation. A validation warning tied to current account quotas would reduce failed first deployments. Bedrock documentation would also benefit from a short hackathon pattern that demonstrates how to keep model output advisory while deterministic code remains authoritative.

**Onboarding:** Model discovery and invocation were straightforward. The main friction was an account-level Lambda quota interaction, documented in the friction log. Removing the optional reservation preserved the function's eight-second timeout, memory cap, minimal payload, output validation, and fallback behavior.

**Would we build with it again?** Yes. Bedrock is useful here precisely because its role is small, observable, and replaceable rather than being treated as the source of truth.

## Feature requests

- **Critical:** A generally available Alexa+ local conformance harness that validates MCP transport, identity, tool schemas, structured output, and voice/visual agreement.
- **Important:** A maintained TypeScript example combining Streamable HTTP, OAuth 2.1/PKCE, account linking, MCP Apps, and confirmation-gated transactions.
- **Important:** A supported visual preview for inline and full-screen MCP App surfaces with Alexa host context and accessibility checks.
- **Nice-to-have:** AgentCore Memory examples for entity-scoped operational context, ambiguity handling, expiry, and “start over” behavior.
