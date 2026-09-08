# Flo

Local working draft, September 8, 2026. These updates have not been sent to Devpost.
This replaces the historical draft in `docs/hackathon/devpost-submission.md`.
The replacement video is rendered and its cut approved by the owner; public video
publication and user-only declarations remain separate release gates.

## One-line Summary

An open source MCP operating layer for hands-free service operations.

## Problem

Technicians work with occupied hands: gloves, tools, vehicles and machinery.
Finding a work order, checking parts, preparing an estimate and scheduling a
repair can mean repeatedly stopping the job to navigate different systems.
Customers face a different problem: knowing what is happening with their repair
without exposing someone else's information.

## Solution

Flo demonstrates a conversational shop workflow backed by real structured MCP
tool execution. Open work order 1842, record an alternator diagnosis, search
compatible offers from three simulated suppliers, compare alternatives, calculate
an estimate, simulate customer approval, resume the job and prepare a purchase
with Bay 2 scheduling. Nothing is purchased or scheduled until the explicit
confirmation passes server-side checks. All shop purchases and messages are
simulated service operations, not real supplier orders or customer notifications.

A separate AWS-hosted customer site uses real Login with Amazon. Amazon identifies
the visitor; a separately authorized shop mapping determines repair access. The
tested fictional customer can read repair 1842 but cannot read another customer's
2842 or an unknown repair. Unlinked visitors remain signed in without repair
access and can sign out. These hosted projections are independent test fixtures,
not synchronized shop data; they have no estimate or scheduled appointment.

## Why This Matters

The prototype makes a concrete interface tradeoff: short conversational commands
for hands-busy work, visual comparisons for detail, and explicit confirmation for
transactions. Its reusable contribution is the separation of intent, structured
tools, deterministic business rules and authority. Adapters could support other
service industries later; no commercial shop integration or measured productivity
improvement is claimed.

## How We Used AI

Flo is a custom Alexa-style simulation, not a certified Alexa+ add-on. Its current
command routing and reference resolution are deterministic and bounded. Browser
speech input is optional; typed commands remain available. The model does not
independently plan an arbitrary workflow.

The optional deployed narrator calls Amazon Bedrock Converse with Amazon Nova
Lite for one short qualitative lead sentence. Flo sends a minimal, non-personal
payload, validates the response and falls back locally on failure. Code, not the
model, owns part choice, fitment, money, permissions, approval and transaction
state. Bedrock is not used to decide repair ownership. Official Alexa+ account
linking, host integration, MCP App packaging and certification remain incomplete.

## How We Used Codex

Codex assisted the TypeScript implementation, deterministic engine and permission
tests, transaction-integrity debugging, Docker/CI checks, AWS deployment review,
and reconciliation of release claims with recorded results. The owner handled
account sign-in and approved scoped cloud changes. Tests and service read-backs,
not generated explanations alone, are the evidence for implementation claims.
No Kiro Crew or Strands usage is claimed.

## Key Features

- MCP Streamable HTTP with a tested `2025-11-25` negotiation; 25 non-demo shop tools
  plus three demo controls. These are mock-backend tools, not production-certified
  commercial operations.
- Four HTTP mock services for shop, inventory, supplier and customer operations.
- Deterministic fitment, integer-cent estimates and explicit comparison rankings.
- Approval-to-estimate/SKU binding, role checks, single-use confirmation,
  idempotency, scheduling conflict checks and audit records.
- Job context survives a new conversation in the local running process; restarting
  or resetting the mock environment is not durable shop persistence.
- A local read-only owner preview omits shop cost, supplier details and margin.
- Separate hosted LWA sign-in, durable trusted linking and fictional repair
  isolation, with private enrollment authority and negative-access checks.

## Architecture

Local: browser simulator → MCP client → Flo Streamable HTTP server → orchestrator
and deterministic engines → HTTP adapters → four mock services.

Hosted customer: browser → HTTPS API Gateway/Lambda → validated LWA identity and
session → trusted customer link → customer-safe DynamoDB repair projection.
Private enrollment approval is distinct from customer consent/redemption.

Optional narration: server-side signed request → IAM-protected API Gateway/Lambda
→ DynamoDB model-attempt allowance → Bedrock. CloudWatch records bounded
operational logs. Secrets Manager supplies private customer staging configuration.
CloudFormation defines reproducible deployments and scoped permissions.

There is no synchronization arrow between hosted repairs and local shop state.
AgentCore Runtime/Memory/Gateway are future work, not deployed components.

## Testing Instructions

### Credential-free judge path: local simulation

Use Node.js 22+ and pnpm 11, or Docker Compose. The public repository contains
source, MIT license and example configuration. Do not supply AWS credentials for
the local fallback or expose mock services publicly.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test
node --test scripts/*.test.mjs
pnpm docker:up
```

The local owner preview is at `http://127.0.0.1:4200/`; the separate shop demo is at
`http://127.0.0.1:4200/shop`. Acknowledge the synthetic-data notice. Follow the
[README workflow](README.md#shop-demonstration-workflow). Simulate approval only
with the labeled demo control; prepare the transaction, inspect it, then confirm.
Start a new conversation before asking about the Ford to demonstrate context.
Use `pnpm demo:reset` only for this disposable local environment.

The best-gross-profit branch selects the $289 shop-cost option, $101.15 gross
part profit and $561.33 estimate. The balanced $219 option instead produces a
$459.03 estimate. Do not mix these branches in screenshots or narration.

`node scripts/docker-smoke.mjs` resets the disposable local demo and exercises
its full workflow; never point it at staging or a real shop. Linux CI separately
executes Docker and isolated customer/enrollment contracts. Some POSIX-only tests
are explicitly skipped on Windows.

### Hosted customer path

The public site supports real LWA. Signing in does not enroll a judge as a customer
and does not grant arbitrary repair access. The unlinked state and sign-out are
available without private operator access. The existing linked fictional test
identity must not be shared. Use the replacement recording and dated isolation
report for that controlled scenario; use the credential-free local route for
independent end-to-end judging. Never publish an Amazon password, token, invitation
or AWS credential in testing instructions. Any additional hosted judge enrollment
requires a separately designated test identity and authorization.

Evidence: [hosted pairing](docs/verification/fictional-a-pairing-completed-2026-09-08.md),
[hosted A/B isolation](docs/verification/customer-repair-fixture-live-2026-09-08.md),
and [CI for source 10c65fb](https://github.com/agammann/flo/actions/runs/34197470959).
That CI run proves the named source, not future changes or official Alexa testing.

## Public Demo Link

https://i4ceh4qpdg.execute-api.us-west-2.amazonaws.com/

Separate, read-only customer staging site with identity/ownership restrictions.
It is not a public shop simulator or an authenticated Alexa MCP endpoint.

## Public Repository Link

https://github.com/agammann/flo — MIT license; GitHub username `agammann`.

## Demo Video

**Replacement rendered; owner approved the cut. Public publication is pending.**
Final public URL: **pending publication and public watch-page verification**.

`Flo-demo-2026-09-08.mp4` is 2:53.99, with the original Ryan narration voice and
46 English caption cues. It records the real local MCP workflow and corrected
gross-profit branch. Hosted identity/isolation uses the public signed-out page
and a clearly labeled September 8 evidence card, not a fresh authenticated-session
recording. See [the cut's source, captions and review](docs/demo/replacement-cut-2026-09-08.md).

The original `ZjROvjL2smo` cut and its caption track are historical. Do not paste
that URL into the final form as proof of the corrected release. Use the
[replacement plan](docs/demo/video-reconciliation.md) and
[historical narration draft](docs/demo/replacement-narration.md).
Keep
"not made for kids" as instructed. Review the rendered audio, captions, title,
thumbnail and description before separate publication approval.

## Screenshot Shot List

1. Hosted linked fictional repair 1842: hide identity, tokens and browser account UI.
2. Hosted denied repair 2842: no other customer's data; label fictional fixture.
3. Local shop comparison: show both balanced and gross-dollar-profit rankings.
4. Local estimate/approval: matching selected part and clear simulated approval.
5. Local prepared transaction and confirmed result: visible confirmation boundary.

The recorded-cut directory includes three actual local UI screenshots: ranking,
estimate and successful order/schedule. These are not hosted-customer screenshots.
No authenticated hosted screenshot is claimed; its dated test report is separate.

## Submission Readiness Notes

The local packet is now reconciled to dated pairing/isolation evidence. The
recorded application source is checkpoint `10c65fb` plus estimate display fix
`578fdcd8677d1411106d2a4730c210e6bbfaaf4e`. Local compilation, tests, lint and typecheck passed after that fix.
The final pushed documentation/source commit needs a fresh green CI result.
The old video cannot establish the corrected ranking or hosted identity flow.
This draft does not certify rule eligibility or constitute a Devpost form write.

## Known Limitations

- No official Alexa+ add-on deployment, account-linking flow, Inspector,
  Amazon simulator/device validation, certification or MCP App package.
- No AgentCore deployment or general-purpose LLM orchestration.
- No real supplier, shop, payment, notification or booking integration.
- Local operational state is in-memory. Hosted test fixtures are separate and
  have no estimate or schedule; there is no cross-environment synchronization.
- One real Amazon identity was paired to a fictional A designation; B was an
  isolated fixture, not a second signed-in Amazon account. This is not a test of
  real-world repair ownership verification.
- Throttles and finite model-attempt allowance are not an account-wide dollar cap.
- Production consumer booking requires integration-route review with Amazon.

## TODO Official Form Fields

Mapped from the live September 8 Devpost form; re-read it before final entry.
These are draft answers, not accepted legal declarations or remote form state.

| Field ID | Field | Draft answer / remaining input |
| --- | --- | --- |
| 28285 | Submitter Type | Individual, based on the owner's solo instruction |
| 28286 | Organization Name | N/A unless the owner changes submitter type |
| 28287 | Country of Residence | United States — confirmed by owner September 8, 2026 |
| 28288 | Canadian province | N/A — owner resides in the United States |
| 28289 | Primary Track(s) | Alexa+; clearly labeled custom simulated experience |
| 28290 | Public repository | https://github.com/agammann/flo |
| 28291 | New/existing before August 31 | New — owner confirmed first created on or after August 31, 2026 |
| 28292 | Existing-project changes | Not applicable — new project |
| 28293 | AWS Builder | Yes, as requested; documented implemented services only |
| 28294 | AWS services and use | Use AWS integration paragraph below |
| 28295 | Open Source | Yes, as requested |
| 28296 | Contribution URL | https://github.com/agammann/flo/commit/10c65fb8a3440c0144077c135355e47fa7bc87db |
| 28297 | Repository URL | https://github.com/agammann/flo |
| 28298 | GitHub username | agammann |
| 28299 | Contribution description | Use Open Source paragraph below |
| 28300 | Feature Requests, optional | See product-feedback.md; distinguish requested tools from tools not yet tested |
| 28301 | Friction Log, optional | https://github.com/agammann/flo/blob/main/docs/hackathon/friction-log.md |
| 28302 | Testing Link, optional | Hosted customer URL above, with limitations and local setup fallback |
| 28303–28307 | Five product-feedback answers | Source: docs/hackathon/product-feedback.md; reshape by question before form entry |
| 28308–28310 | Age, jurisdiction, employee declarations | Owner must explicitly attest to the actual checkbox text; rules acknowledgment does not prefill these |

The current official form does not request a Codex session ID; none is included.

### AWS Builder answer

Flo uses Lambda and API Gateway for a hosted customer service and a separate
IAM-authenticated Bedrock narrator. Bedrock Converse/Nova Lite supplies a bounded
qualitative sentence, never business decisions. DynamoDB holds a finite narrator
attempt allowance and separate customer auth/session, trusted-link, enrollment
and repair-projection state. Secrets Manager supplies private staging runtime
configuration. CloudFormation, IAM, KMS and finite-retention CloudWatch logging
support deployment and security boundaries. Recorded live tests cover signed and
rejected narrator calls, real LWA, controlled fictional pairing and A/B repair
isolation. AgentCore is not deployed. Local shop operations remain mock services
and are not synchronized with hosted customer fixtures.

### Open Source answer

I built and hardened Flo's MIT-licensed TypeScript MCP service-workflow prototype.
It connects bounded conversational commands to HTTP mock services, with
deterministic compatibility, pricing, approval, confirmation and authorization
rules. The linked contribution adds regression coverage and reproducible evidence
for customer-specific repair access and reconciles release claims with what was
tested. Developers can run the local Docker demonstration without commercial API
credentials and extend the adapter interfaces. The value is an inspectable,
tested separation between identity, ownership and transactional authority rather
than a chatbot trusted to invent or authorize business state.
