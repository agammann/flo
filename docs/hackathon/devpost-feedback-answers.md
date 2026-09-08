# Flo — official feedback field drafts

Prepared September 8, 2026 from `product-feedback.md` for live Devpost fields
28303–28307. These are local drafts, not a form submission. Observations refer to
dated project tests, not a new AWS audit or unperformed official Alexa testing.

## 28303 — Which developer tools, APIs, and SDKs did you use and for what?

Alexa+ add-on documentation informed the repair-information prototype, the MCP
integration route, voice/visual design and confirmation boundaries. The MCP
TypeScript server and client SDKs implement actual Streamable HTTP tool calls,
typed schemas and transport tests. A custom browser simulator demonstrates the
experience with optional browser speech input and typed-command fallback; it is
not Amazon's official simulator or a certified add-on.

Amazon Bedrock Converse with Nova Lite provides an optional, non-authoritative
comparison lead sentence through a separate IAM-authenticated Lambda/API Gateway
narrator. DynamoDB keeps a finite model-attempt allowance. The customer staging
site uses Login with Amazon for website identity, API Gateway/Lambda for HTTPS
hosting, DynamoDB for sessions, trusted links, enrollment and fictional repair
projections, and Secrets Manager for private runtime configuration. CloudFormation,
IAM, KMS and finite-retention CloudWatch logs support deployment and authority
boundaries. Hosted customer fixtures are separate from local shop state.

TypeScript/Node.js, Zod and Express implement application and validation code;
pnpm manages the monorepo; Docker and GitHub Actions run repeatable checks. Codex
assisted implementation, debugging, tests and release-evidence review. No AgentCore,
Kiro Crew, Strands or official Alexa device/toolkit execution is claimed.

## 28304 — For each tool, API, or SDK used in your project, what worked well?

Alexa+ documentation helped separate conversational capabilities, category
contracts and consumer-facing policy requirements. The MCP SDK's client/server
split allowed independent transport tests, including negotiation of 2025-11-25
and a real structured tool call. The custom browser UI exposed tool traces and
visual confirmations while typed input kept the demo usable without a microphone.

Bedrock Converse supported a compact advisory call with local fallback. Lambda
and API Gateway made the two HTTP services inspectable, and IAM/SigV4 checks
distinguished signed narrator calls from unsigned requests. DynamoDB conditional
operations supported the shared attempt allowance and separate enrollment/session
state. Login with Amazon sign-in and sign-out could be verified independently of
repair access. Secrets Manager kept runtime configuration out of the frontend.
CloudFormation change sets, scoped KMS policies and CloudWatch logs made deployment
and operational boundaries reviewable.

TypeScript, Zod and Express made domain/HTTP contracts explicit. pnpm organized
shared packages. Docker and GitHub Actions reproduced tests outside the Windows
host; Codex helped turn observed transaction failures into regression tests.

## 28305 — For each tool, API, or SDK used in your project, what needs work?

Alexa documentation entry points could more clearly distinguish legacy skills,
MCP add-ons, category integration and custom simulation. Examples should identify
whether they were tested in an official host, a device or only a local client.
The MCP SDK would benefit from a protocol-version matrix and complete server/client
examples for the exact minimum revision. Browser speech availability varies, and
our custom preview cannot validate Alexa host context or certification.

CloudFormation schema validation did not predict the account's Lambda reserved-
concurrency quota failure. Account-aware warnings would improve first deployments.
Bedrock examples could better show advisory output alongside deterministic business
logic. LWA identity must not be mistaken for service authorization or ownership;
a worked identity-to-operator-approval-to-redemption example with negative tests
would help. IAM simulation was not a substitute for actual authorized/denied
calls; KMS conditions needed precise service-path review. DynamoDB backup and
restore policies needed explicit treatment so restored state would not undo logout
or replenish a model allowance. API Gateway/CloudWatch log configuration and
Secrets Manager permissions required deliberate payload/credential minimization.

For TypeScript/Node.js, Zod, Express and pnpm we encountered integration and
configuration work rather than a confirmed provider defect. Windows/POSIX
differences required Docker tests; CI and Codex-generated changes still needed
source review and real execution evidence.

## 28306 — For each tool, API, or SDK used in your project, how was onboarding?

Alexa+ concepts were understandable, but official end-to-end add-on validation
remains incomplete; our documentation review and custom simulator are not proof
of partner tooling access. MCP implementation became straightforward after
resolving the protocol-version boundary. The browser simulator used ordinary web
technology and needed clear labeling plus typed input as a speech fallback.

Bedrock model discovery and the initial Converse invocation were straightforward.
Lambda reserved concurrency introduced an account-quota hurdle during
CloudFormation deployment. A later reviewed quota/hardening change resolved the
reservation issue. API Gateway, IAM and KMS required careful live read-back rather
than trusting template validation alone. CloudWatch retention and operational
logging were configured explicitly. Secrets Manager configuration stayed private.
DynamoDB conditional state and recovery semantics required application-level
design, not just table creation.

LWA website login was easier than safe customer mapping: the latter required
separate enrollment, private operator authority, customer redemption and actual
denial checks. TypeScript/Node.js, Zod, Express and pnpm were familiar building
blocks. Workspace-local tooling and Docker addressed Windows host constraints;
GitHub Actions supplied Linux coverage. Codex accelerated iteration, while tests
and user-approved hosted operations remained necessary verification steps.

## 28307 — Would you build with these devices and services again?

Yes to Alexa+ documentation and the MCP approach for structured service workflows,
while reserving judgment on official toolkit/device experience until actually
tested. Yes to the MCP TypeScript SDK and the custom web simulator for development:
they provide inspectable tool boundaries without requiring commercial APIs.

Yes to Bedrock for bounded advisory text, not pricing or authorization decisions;
Lambda/API Gateway for separate HTTP workloads; DynamoDB for conditional state;
LWA for identity with independently verified ownership; Secrets Manager for private
configuration; and CloudFormation, IAM, KMS and CloudWatch for reviewed deployment,
permissions, encryption and logs. We would preserve the distinction between
website login and official Alexa service/user authorization. Costs and recovery
policies still need workload-specific review; throttles are not a dollar cap.

Yes to TypeScript/Node.js, Zod, Express, pnpm, Docker, GitHub Actions and Codex,
with pinned dependencies, platform-specific tests and evidence-linked release
claims. We have no hands-on conclusion about AgentCore, Kiro Crew, Strands or
Alexa devices because those are not implemented/tested parts of this project.
