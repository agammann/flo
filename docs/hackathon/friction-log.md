# Hackathon friction log

## 2026-09-06 UTC — Scoped log-permission simulation discrepancy

- **Technology:** IAM SimulateCustomPolicy, CloudWatch Logs, IAM Policy Autopilot 0.3.0.
- **Attempt:** Validate exact-resource enrollment boundaries after generated baselines remained broader than the required role separation.
- **Expected:** The exact allowed log stream should match; unrelated streams should be denied.
- **Actual:** Table and Lambda-version cases matched expectations, but log cases returned implicit deny, including a separate minimal exact-resource Allow control. No cause has been established.
- **Documentation:** [IAM simulator](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_testing-policies.html) and [Logs service reference](https://servicereference.us-east-1.amazonaws.com/v1/logs/logs.json).
- **Workaround:** None applied. Preserve the discrepancy and keep runtime route enablement gated pending official-tooling/live-role log verification. Do not expand log resources merely to obtain a simulator pass.
- **Suggested improvement:** Surface why an otherwise matching exact-resource control has no matching statements, including unsupported simulation cases if applicable.
- **Impact:** Runtime deployment readiness remains incomplete; no live policy or customer access was changed. [Evidence](../verification/enrollment-runtime-boundary-2026-09-06.json).

## 2026-09-05 — Docker engine access and CloudShell build compatibility

- **Technology:** Docker Desktop on Windows, restricted Codex execution, AWS CloudShell Docker and Compose.
- **What we attempted:** Run the repository's real container build, Compose demo, and DynamoDB Local customer tests before staging exposure.
- **Expected behavior:** The installed Docker CLI could reach the engine, and Compose could build the image.
- **Actual behavior:** Windows PowerShell reached Docker's Linux engine, but the Codex session received named-pipe permission denial. In CloudShell, Compose required a newer Buildx than was installed.
- **Documentation used:** Docker Windows installation guide, official OpenAI Windows sandbox documentation, Docker's published Compose release checksum, and observed command output.
- **Workaround:** With owner approval, resume the existing isolated CloudShell environment. Build the same Dockerfile with `DOCKER_BUILDKIT=0 docker build`, then use verified standalone Compose with `up --no-build`. Do not expose an unauthenticated Docker TCP endpoint or change live AWS resources.
- **Suggested improvement:** Publish tested Docker/Buildx/Compose combinations for CloudShell and document scoped Windows engine access for sandboxed development tools.
- **Impact:** Additional environment setup and verification time. Actual container demo, database integration, and packaged Lambda checks passed; see [verification evidence](../verification/cloudshell-docker-2026-09-05.md).

## 2026-09-05 — Reconciling Alexa+ documentation before certification work

- **Technology:** Alexa+ MCP Toolkit documentation, Inspector, authentication and Alexa AI CLI.
- **What we attempted:** Read the complete supplied documentation set and map transport, setup and linking examples to Flo's local prototype.
- **Expected behavior:** Protocol examples, supported host environments and CLI flag examples would agree across the linked guides.
- **Actual behavior:** The Toolkit overview names MCP 2025-11-25, while lifecycle/Inspector examples show earlier revisions; the setup OS list and Windows Inspector examples differ; account-linking CLI examples differ from the CLI reference. These are documentation observations, not a failed official tool run. The supplied Category Action/Category MCP links both resolve to the Toolkit overview's empty fragment.
- **Documentation used:** [Toolkit overview](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview.html), [lifecycle](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-client-lifecycle.html), [Inspector](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-local-inspector.html), [setup](https://developer.amazon.com/docs/alexaplus/add-ons/set-up-your-development-environment.html), [account linking](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-account-linking.html), [CLI reference](https://developer.amazon.com/docs/alexaplus/add-ons/alexa-ai-cli-reference.html).
- **Workaround:** Keep the explicit 2025-11-25 transport regression, follow actual navigation for category pages, and leave production customer access closed. Confirm supported CLI flags and identity behavior with Amazon before deployment.
- **Suggested improvement:** Version-stamp examples against one tested CLI release, unify the environment support matrix, and link category headings to real overview guides.
- **Severity:** Important.
- **Impact on development:** Documentation reconciliation time; official integration remains unverified. Local owner-read tools and regression tests can proceed independently.

## 2026-09-04 — AWS Lambda reserved concurrency on a new free-plan account

- **Technology:** AWS CloudFormation and AWS Lambda
- **What we attempted:** Deploy the optional Flo Amazon Bedrock narration function with `ReservedConcurrentExecutions: 1`.
- **Expected behavior:** Limit the demo function to one concurrent invocation as an extra cost-control guard.
- **Actual behavior:** Lambda rejected creation because that reservation would reduce the account's unreserved concurrency below AWS's minimum of 10.
- **Documentation used:** CloudFormation stack events and the Lambda service error returned during deployment.
- **Workaround:** Removed the optional reserved-concurrency property. The function still has an eight-second timeout, a 256 MB memory cap, a narrow Bedrock permission, strict payload validation, and simulator-side fallback.
- **Suggested improvement:** Surface the account's reservable concurrency and the minimum unreserved requirement during template validation, before stack creation begins.
- **Impact on development:** One failed stack creation and a short redeploy; no application behavior or transaction-safety rule changed.

This log records observed development friction constructively. It should be updated whenever a real issue is reproduced; hypothetical concerns do not belong here.

## 2026-09-05 — LWA credential prefix and legacy length guidance

- **Technology:** Login with Amazon security profiles and server-side token exchange.
- **What we attempted:** Prepare hosted customer sign-in using the registered LWA profile and a Secrets Manager reference.
- **Expected behavior:** The server should accept the provider-issued opaque client credential and forward it unchanged to the fixed Amazon HTTPS token endpoint.
- **Actual behavior:** Flo's original validator copied the older Security Profile page's 64-byte maximum. A synthetic `amzn1.oa2-cs.v1.` prefix plus 64-character payload reproduced rejection before any provider request. Current official Amazon LWA credential examples include that prefix.
- **Documentation used:** [LWA Security Profile](https://developer.amazon.com/docs/login-with-amazon/security-profile.html) and [Amazon's LWA credential example](https://developer-docs.amazon/sp-api/docs/onboarding-step-5-make-your-first-call-to-the-sp-api-sandbox). The latter is an SP-API onboarding example of LWA credentials, not a Flo integration contract or a published new maximum.
- **Workaround:** Accept nonempty printable-ASCII credentials with an application-defined 1024-byte bound, preserve the entire value, and test prefix preservation in mocked token exchange and Lambda/durable-auth fixtures. Keep live login disabled until the corrected package is reviewed and deployed.
- **Suggested improvement:** Reconcile the older byte-limit text with currently issued credential formats and provide a current validation example.
- **Impact:** A new application package is required before live LWA enablement. Local synthetic tests do not prove validity of the stored credential or grant repair ownership.

## 2026-09-03 — MCP TypeScript SDK generation boundary

- **Technology:** Model Context Protocol TypeScript SDK v2
- **What we attempted:** Implement a Streamable HTTP MCP server that meets the challenge’s minimum `2025-11-25` protocol requirement using the current stable TypeScript SDK.
- **Expected behavior:** A current SDK example would clearly show how to serve the newest protocol while retaining the exact required legacy revision.
- **Actual behavior:** The v2 package documentation emphasizes the newer protocol era. The HTTP serving guide and type declarations were needed to discover the stateless legacy compatibility option and verify that a legacy client negotiates `2025-11-25`.
- **Documentation used:** MCP TypeScript SDK HTTP serving guide and published SDK package type declarations.
- **Workaround:** Configure `createMcpHandler` with stateless legacy support and add an integration test that asserts the negotiated transport version is exactly `2025-11-25` before calling a tool.
- **Suggested improvement:** Add a short, challenge-oriented compatibility table showing server configuration for `2025-11-25` and later clients.
- **Severity:** Important.
- **Impact:** Moderate documentation time; no feature reduction.

## 2026-09-03 — AgentCore architecture before account deployment

- **Technology:** Amazon Bedrock AgentCore Runtime and Memory
- **What we attempted:** Define a Node/TypeScript deployment boundary without making unverified claims about an AWS account or enabled regional features.
- **Expected behavior:** The local application interface and the managed runtime/memory responsibilities would map one-to-one.
- **Actual behavior:** Runtime and Memory have separate setup and lifecycle guidance, so treating “AgentCore” as a single deployment target would hide important identity, persistence, and observability decisions.
- **Documentation used:** AWS AgentCore Runtime Node deployment, MCP runtime, and Memory developer guides.
- **Workaround:** Keep orchestration and memory behind explicit interfaces, document each AWS responsibility, and defer deployment claims until live account verification.
- **Suggested improvement:** Provide one maintained TypeScript reference that combines MCP hosting, AgentCore Runtime, Memory namespace design, identity, and CloudWatch redaction.
- **Severity:** Nice-to-have for the current local demo; important for the AWS Builder path.
- **Impact:** Low implementation impact; improved architecture clarity.

## 2026-09-03 — Package build scripts in restricted Windows environments

- **Technology:** pnpm, esbuild-dependent test tooling, Windows process policy
- **What we attempted:** Use a common Vite/Vitest development stack in the local build environment.
- **Expected behavior:** Installed package binaries would spawn during build and test.
- **Actual behavior:** Child process creation returned `EPERM` for esbuild and Node test worker isolation, despite ordinary Node execution being available.
- **Documentation used:** Local command output and package lifecycle logs.
- **Workaround:** Compile tests with TypeScript, run them through `node:test` in one process, and keep the repository’s application code free of a mandatory bundler.
- **Suggested improvement:** Tooling guides for restricted Windows sandboxes should document no-worker/no-esbuild verification paths.
- **Severity:** Nice-to-have.
- **Impact:** Low; the suite remains deterministic and now has fewer runtime dependencies.

## 2026-09-03 — Alexa+ add-on validation without partner access

- **Technology:** Alexa+ MCP Toolkit and MCP Apps
- **What we attempted:** Validate the working Flo MCP server and visual workflow against the current Alexa+ developer contract.
- **Expected behavior:** Local conformance could be followed immediately by an official Alexa+ add-on connection and surface test.
- **Actual behavior:** The public developer overview says Alexa+ developer access is currently available to select partners. Public documentation defines the transport, MCP Apps, display, schema, and customer-experience contracts, but a local browser simulator cannot prove official invocation or hosted rendering.
- **Documentation used:** Alexa+ developer overview, MCP Toolkit overview, add-on design guide, conversation surface, display modes, visual foundations, accessibility, tool-schema guidance, and customer-experience testing guide.
- **Workaround:** Align the local implementation with the documented contracts, add a written fit audit, and retain an explicit evidence boundary: the local simulator is not presented as an official Alexa+ simulator or deployed add-on.
- **Suggested improvement:** Provide a generally available local Alexa+ conformance harness that validates tool schemas, structured output, host context, CSP, voice/screen agreement, and display modes before partner deployment.
- **Severity:** Critical for claiming official Alexa+ add-on validation; not blocking for the hackathon’s documented custom-simulation path.
- **Impact:** Official integration and device claims remain blocked; local MCP transport, tool execution, safety, and visual behavior can still be tested thoroughly.
