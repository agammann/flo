# Hackathon friction log

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
