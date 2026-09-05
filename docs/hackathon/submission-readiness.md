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
| Public English demo under 3 minutes | The 2:41 video at `https://youtu.be/ZjROvjL2smo` is uploaded and playable by link; reviewed English WebVTT captions are in `docs/demo/flo-demo.en.vtt` | Uploaded but still unlisted; upload captions and obtain separate confirmation before making it public |
| Product feedback for tools used | `docs/hackathon/product-feedback.md` covers Alexa+ guidance, MCP, the simulator, CloudFormation, Lambda, and Bedrock | Ready |
| Track selection | Alexa+ | Select on Devpost |
| Prior-project disclosure | Flo was created for this hackathon unless the entrant states otherwise | Entrant must confirm before final submission |

## Optional mini challenges

### Open Source

Eligible. The new public repository is `https://github.com/agammann/flo`, GitHub username `agammann`, and GitHub detects the MIT license. The repository includes its README, contribution guide, security policy, code of conduct, CI workflow, and reproducible source. The same repository URL is the Open Source contribution URL; the contribution description is ready in `devpost-submission.md`.

### AWS Builder

Eligible. Flo's deployed Lambda function calls Amazon Bedrock through the Converse API using Amazon Nova Lite for a constrained parts-comparison narration lead. The CloudFormation stack was verified `CREATE_COMPLETE`, one live invocation succeeded, and the rejection path returned HTTP 403. The repository documents the exact boundary: compatibility, ranking, money, approval, purchases, and scheduling remain deterministic. Select AWS Builder and show the `AWS · amazon_bedrock_narration` trace in the demo.

## Final evidence gate

Do not call the submission complete until all of the following are observed:

1. The GitHub repository opens without authentication and contains the runnable source, assets, instructions, and MIT license.
2. The demo video plays publicly, is in English, is shorter than three minutes, and visibly shows the MCP tools executing.
3. The Devpost story uses only implemented features and verified URLs.
4. Product feedback and optional friction entries are saved, with a severity for every friction entry.
5. Selected tracks match actual implementation evidence.
6. Devpost shows the final submitted state, not merely a saved draft.
