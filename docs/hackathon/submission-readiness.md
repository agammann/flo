# Hackathon submission readiness

Audit date: 2026-09-04

## Current release checkpoint — September 5, 2026 (Pacific)

The dated sections below are historical. Current read-only checks found the customer and narrator stacks `UPDATE_COMPLETE`, the artifact stack `CREATE_COMPLETE`, and only the two existing Lambda functions in us-west-2. The hosted customer website passed all 16 pre-login asset/security/denial checks again. Real sign-in/sign-out was previously reported by the owner; this repeat did not authenticate a real person or establish a customer mapping.

The Devpost connection currently returns project `1416486` as `Untitled`, empty description, no video URL and `submitted_at: null`. Do not confuse this with a completed submission. Its live event requirements permit a simulated Alexa+ web experience, require public source and a public English demo under three minutes, and require developer-tool feedback. The original video needs replacement and separate publication review. User-only eligibility declarations and final submission confirmation are still required.

The latest local application suite is 151 tests (Windows: 148 pass/3 platform skips; Linux: 150 pass/1 platform skip), with build, typecheck, lint, isolated bundle smoke and Docker Compose database contracts passing. Private enrollment runtime/IAM deployment and hosted customer-pairing tests are incomplete. The [fresh retention template validation](../verification/enrollment-retention-validation-2026-09-05.json) found no schema findings and two unchanged Guard policy failures requiring scoped treatment; no deployment was performed. A later source push or green CI does not prove those external gates complete.

This checklist records dated hackathon evidence, not current certification readiness. Both Devpost requirements and Alexa+ certification requirements apply to the intended release; see the [September 5 certification tracker](../alexa-plus-certification-plan.md). The new local vehicle-owner preview is read-only, not published or certified. The original exclusively internal shop workflow is not by itself consumer-eligible. Reconcile the video with the corrected gross-profit ranking before final publication. Earlier counts, CI links and external statuses below are historical observations, not verification of today's uncommitted changes.

## Primary track: Alexa+

September 5 local identity increment: a separate Login with Amazon website and trusted customer-link adapter are implemented with simulated-provider tests, including in-flight logout and reassignment protection. The full local suite now passes 62 tests. The signed-in LWA console still showed no setup; no live profile/callback or official Alexa linking was configured. See [the dated sign-in evidence](../verification/customer-signin-2026-09-05.md). This does not update the historical CI/cloud/video evidence below.

| Requirement | Evidence | Status |
| --- | --- | --- |
| Working Alexa+ project | Flo demonstrates a voice-first service-operations workflow through a custom web simulation | Ready locally |
| Self-hosted MCP server | `@modelcontextprotocol/server` runtime with 25 production tools | Ready locally |
| MCP spec `2025-11-25` or later | Transport integration test asserts negotiation of `2025-11-25` | Verified locally |
| Streamable HTTP | MCP endpoint at `/mcp`, called by the official TypeScript client | Verified locally |
| Required technology appears in code | Server/client imports, registration, connection, and live tool call are in source | Verified locally |
| Working demo | Complete diagnosis-to-approval-to-confirmed-purchase-and-schedule flow | Verified locally |
| Safe external actions | Approval, actor-bound confirmation, revalidation, idempotency, rollback, and audit records | Verified locally |

## Required submission artifacts

| Requirement | Current evidence | Status before submission |
| --- | --- | --- |
| Text description | `docs/hackathon/devpost-submission.md` | Draft ready with verified repository and video URLs |
| Public GitHub repository | `https://github.com/agammann/flo` opened anonymously with the complete source | Verified public |
| Open-source license visible at top/About | GitHub detects the repository's MIT license | Verified public |
| Public English demo under 3 minutes | The 2:41 video at `https://youtu.be/ZjROvjL2smo` is uploaded and playable by link; 33 reviewed English WebVTT cues are published in YouTube Studio and a custom thumbnail is saved | Still unlisted; obtain separate confirmation before making it public and verify the public watch page |
| Product feedback for tools used | `docs/hackathon/product-feedback.md` covers Alexa+ guidance, MCP, the simulator, CloudFormation, Lambda, and Bedrock | Ready |
| Track selection | Alexa+ | Select on Devpost |
| Prior-project disclosure | Flo was created for this hackathon unless the entrant states otherwise | Entrant must confirm before final submission |

## Optional mini challenges

### Open Source

Eligible. The new public repository is `https://github.com/agammann/flo`, GitHub username `agammann`, and GitHub detects the MIT license. The repository includes its README, contribution guide, security policy, code of conduct, CI workflow, and reproducible source. The same repository URL is the Open Source contribution URL; the contribution description is ready in `devpost-submission.md`.

### AWS Builder

Flo has working AWS Builder integration evidence. Its deployed Lambda function calls Amazon Bedrock through the Converse API using Amazon Nova Lite for a constrained parts-comparison narration lead. The IAM-protected CloudFormation stack was verified `UPDATE_COMPLETE` in `us-west-2`. Live checks returned HTTP 403 for unsigned requests carrying only the former build marker, 429 for a signed request before allowance initialization, 400 for an invalid signed task, and 200 for valid signed narration. The approved allowance was initialized once to 100 model attempts; verification consumed one, leaving 99 at read-back. API Gateway targets 1 request/second with burst 2, and CloudWatch log retention is 7 days. The finite model allowance is not a hard dollar cap for all AWS services. Compatibility, ranking, money, approval, purchases, and scheduling remain deterministic. The successful signed live test ran from AWS CloudShell; a simulator host must separately have an authorized AWS identity to produce the `AWS · amazon_bedrock_narration` trace and otherwise uses deterministic fallback.

## Hardened release verification

The hardened transaction source passed [CI run 3](https://github.com/agammann/flo/actions/runs/33944222960). A subsequent [real Docker Compose CI run](https://github.com/agammann/flo/actions/runs/33944682177) built the image, started all six services, completed approval, resumed context, purchase and scheduling through MCP, rejected duplicate confirmation, and shut down successfully. Docker/WSL remain absent from the Windows development host, but the Linux-runner Compose launch is now verified. Demo ports bind to loopback only.

AWS source commit `957b3b8c8bad264b5911f5c386610bee77282f84` replaces public-marker access with IAM/SigV4 and adds a retained, atomically reserved lifetime model allowance. Its seven new boundary tests bring the suite to 34 passing tests; [CI run 6](https://github.com/agammann/flo/actions/runs/33945488566) passed verification and real Docker Compose execution. Following explicit approval, that exact template was deployed and verified live. See [deployment verification](../verification/aws-protection-2026-09-04.md) for checks, source checksum, allowance read-back, and remaining limitations.

An Alexa+ MCP Toolkit partner-onboarding support case was submitted via the official developer support portal. Access, an assigned Solutions Architect, and official add-on/device validation are still pending Amazon's response. A read-only AgentCore check in us-west-2 returned no deployed runtimes. AgentCore deployment remains incomplete; the working Lambda narrator is not an AgentCore runtime.

YouTube Studio reports the reviewed English track as Published, the custom thumbnail is saved, and the description accurately distinguishes the custom simulator from live Alexa+ device integration. Video visibility remains Unlisted pending the entrant's separate final confirmation. Publishing captions did not change video visibility.

## Final evidence gate

Do not call the submission complete until all of the following are observed:

1. The GitHub repository opens without authentication and contains the runnable source, assets, instructions, and MIT license.
2. The demo video plays publicly, is in English, is shorter than three minutes, and visibly shows the MCP tools executing.
3. The Devpost story uses only implemented features and verified URLs.
4. Product feedback and optional friction entries are saved, with a severity for every friction entry.
5. Selected tracks match actual implementation evidence.
6. Devpost shows the final submitted state, not merely a saved draft.
