# Hackathon submission readiness

Audit date: 2026-09-04

This checklist uses the current Devpost requirements as the source of truth and separates repository evidence from external release evidence.

## Primary track: Alexa+

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

Eligible. Flo's deployed Lambda function calls Amazon Bedrock through the Converse API using Amazon Nova Lite for a constrained parts-comparison narration lead. The hardened CloudFormation stack was verified `UPDATE_COMPLETE`: API Gateway limits requests to a steady 1 request/second with burst 2, and CloudWatch log retention is 7 days. Live calls returned HTTP 200 for the permitted request, 403 for a wrong build marker, and 400 for an invalid task. The marker is not authentication and the throttle is not a hard dollar cap. The repository documents the exact boundary: compatibility, ranking, money, approval, purchases, and scheduling remain deterministic. Select AWS Builder and show the `AWS · amazon_bedrock_narration` trace in the demo.

## Hardened release verification

The published source tree matches the locally verified source exactly. [CI run 3](https://github.com/agammann/flo/actions/runs/33944222960) passed on commit `c3afe01ba274b8c7e126997871efd23313c3727f`, covering the hardened runtime, typed MCP outputs, and regression suite. Local build, typecheck, lint, and all 27 tests passed. Docker demo configuration was repaired and its production-mode environment was smoke-tested, but Docker itself was unavailable on the development host; a successful Docker Compose launch is not claimed.

YouTube Studio reports the reviewed English track as Published, the custom thumbnail is saved, and the description accurately distinguishes the custom simulator from live Alexa+ device integration. Video visibility remains Unlisted pending the entrant's separate final confirmation. Publishing captions did not change video visibility.

## Final evidence gate

Do not call the submission complete until all of the following are observed:

1. The GitHub repository opens without authentication and contains the runnable source, assets, instructions, and MIT license.
2. The demo video plays publicly, is in English, is shorter than three minutes, and visibly shows the MCP tools executing.
3. The Devpost story uses only implemented features and verified URLs.
4. Product feedback and optional friction entries are saved, with a severity for every friction entry.
5. Selected tracks match actual implementation evidence.
6. Devpost shows the final submitted state, not merely a saved draft.
