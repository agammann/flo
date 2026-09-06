# Hackathon submission readiness

Audit date: 2026-09-04

## Latest checkpoint — September 6, 2026

**Fresh local release checks:** full build/typecheck/lint, 148 application tests
(three platform skips), all 56 Node script tests and 25 Python tests passed.
Actual Docker Compose startup, the real HTTP/MCP demo, isolated bundle smokes and
DynamoDB Local transaction contracts also passed. See
[release-source evidence](../verification/release-source-checkpoint-2026-09-06.md).
This supersedes older Docker-unavailable statements, not the remaining hosted
private-enrollment or official Alexa+ verification gates.

**Request-only deployment verified:** the approved KMS correction is now
UPDATE_COMPLETE, live boundary v5 matches the reviewed policy, and one real
signed-in/unlinked request succeeded with HTTP 200 and the visible pending-
verification message. All 12 post-deployment credential-free checks passed.
Approval/redemption remain disabled; no customer was linked. See
[deployment evidence](../verification/request-dynamodb-kms-deployment-2026-09-06.md).
Earlier review-only/503 statements below are historical. Private approval and
redemption verification, trusted designation, CI and release gates remain open.

**Request KMS review:** the most recent signed-in enrollment request returned
503, so successful hosted pairing is still unverified. A tested request-only
permissions correction now has an unexecuted one-resource change set. Full build,
typecheck and lint passed; application tests are 148 passed / three skipped and
infrastructure-script tests are 56 passed. See [current review evidence](../verification/request-dynamodb-kms-review-2026-09-06.md).
Approval/redemption stay disabled. No customer has been linked by this review;
no fresh GitHub Actions run, video publication or Devpost submission is claimed.

The [request-only enrollment deployment](../verification/enrollment-request-only-deployment-2026-09-06.md)
is now `UPDATE_COMPLETE`: request version 3 is enabled; approval and redemption
version 3 remain disabled. Exactly 12 additional credential-free hosted checks
passed, including rejected enrollment inputs and the absent redemption route.
No customer was linked. The obsolete unexecuted review plan was removed without
removing deployed resources. This checkpoint does not establish a successful
hosted ownership-link flow or permission to publish the video or submit Devpost.

Final local recheck after this deployment: all 13 workspace build/typecheck
configurations passed, full ESLint passed, application tests were 148 passed
and three platform skips (151 total), and the combined runtime/operator/template/
policy-exception suite passed 41 tests. No fresh CI or Docker run is claimed
for this increment.

Local Docker Desktop/Compose now works: the real six-service demo and isolated
DynamoDB customer/enrollment contracts passed again. Windows build/typecheck/lint
passed; the application suite remains 151 tests (148 passed, 3 platform skips),
and the corrected boundary/template suite has 27 passing tests. The hosted staging site
passed its 16 credential-free checks. Local AWS CLI identity is verified as
`flo-staging-operator`, not root. A fresh-MFA live test now passes exact-version
authorization and the disabled approval function's safe refusal. Two out-of-scope
DryRuns were rejected. The temporary grant and boundary were removed; only sign-in
permission remains attached. See [live evidence and next gate](../verification/operator-fresh-mfa-test-2026-09-06.md).

Older CLI-unavailable, Docker-absent, table-count, test-count and deployment
statements below are dated history, not the current inventory. No fresh GitHub
Actions run, hosted enrollment success, official Alexa+ validation, replacement
video or final submission is claimed by this checkpoint. Publication stays paused.

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
