# Replacement-video reconciliation

Status: edit plan, not a completed replacement video. September 5, 2026.

The local source is `outputs/Flo-demo.mp4` in the parent workspace. Its segment narration is in `work/flo-video/segments.json`; source frames and audio are alongside it. The repository's `flo-demo.en.vtt` belongs to that existing 2:41 cut. Preserve that caption file and original MP4 until the replacement is rendered, reviewed and explicitly approved. Do not change captions to say something different from the old spoken audio or screen.

The current uploaded video is [ZjROvjL2smo](https://youtu.be/ZjROvjL2smo). Its publication state was not rechecked during this edit-plan pass. No Studio upload, caption replacement, thumbnail replacement or visibility change was performed.

## Required edits

| Existing segment / caption time | Mismatch | Replacement evidence |
| --- | --- | --- |
| Opening and idle, 0:00–0:23 | Only the shop interface is introduced | Introduce the consumer preview and label the shop interface as a separate simulation. No official Alexa/device claim. |
| Parts and margin, 0:34–1:04 | Balanced recommendation is not the highest gross part profit; the original capture explicitly asks for best margin | Show both rankings. Balanced: $219 cost and $76.65 gross part profit. Dollar-profit ranking: $289 cost and $101.15 gross part profit. State that this is dollars, not percentage. |
| Estimate, 1:05–1:16 | $459.03 reflects the $219 balanced part, not the corrected highest-profit selection | If retaining the best-profit command, record the resulting $561.33 estimate: part $390.15, labor $126, fees $12, tax $33.18. Do not mix these branches. |
| Approval and memory, 1:17–1:38 | No vehicle-owner preview is shown | Show owner estimate review and the shop's separate simulated-approval control. The owner preview cannot approve anything. |
| Confirmation and completion, 1:39–2:07 | Original selected part, order and estimate differ from the corrected branch | Re-record the exact new transaction summary, no mutation before confirmation, successful result and duplicate rejection. Use the live generated date/time, not an old fixed date. |
| Architecture, 2:07–2:28 | Narration labels all DynamoDB use as future | Distinguish deployed narrator allowance in DynamoDB from still-planned durable business state. AgentCore remains incomplete. A successful historical Bedrock call is not a fresh live verification. |
| Closing card, 2:28–2:41 | The source contact sheet still displays 14 passing tests | Re-render with the result from the final recorded commit, or omit a hardcoded count. Local test counts change during hardening; use the dated verification report for the exact tested source, not evidence for a future cut. |
| New sign-in scene | Website LWA code and simulated-provider tests exist, but real LWA sign-in and official Alexa+ account linking remain unverified | Record only after real sign-in and ownership isolation are verified. Until then label the implementation and provider-contract tests accurately; never fabricate a success screen. |

## Recording sequence after sign-in is tested

Target approximately 2:50, with timing finalized against the actual narration and footage:

1. **0:00–0:12:** Customer problem and consumer repair-status preview; state custom simulation.
2. **0:12–0:32:** Verified Login with Amazon sign-in, owned repair status and privacy-safe data. Redact all credentials and real customer data; use approved test accounts. If login is not ready, postpone this scene rather than stage it.
3. **0:32–1:02:** Switch to the shop demo, diagnose and search through actual MCP; distinguish balanced and gross-profit rankings.
4. **1:02–1:25:** Create the matching estimate, review it in the owner preview, and explicitly simulate approval from the shop demo.
5. **1:25–1:40:** Start a new conversation and retrieve the stored job status. State that current business state is in-memory unless durable persistence has actually been added and tested.
6. **1:40–2:12:** Prepare, confirm and verify order/scheduling; show a rejected repeat.
7. **2:12–2:40:** Evidence-based architecture: MCP, deterministic engines, optional Lambda/Bedrock narrator, DynamoDB allowance, and accurate deployment/official-Alexa boundaries.
8. **2:40–2:50:** MIT repository, consumer benefit and concise release-status statement.

## Acceptance checks before release

- Run build, typecheck, lint, unit/integration tests and a complete demo smoke against the exact recorded source.
- Choose one pricing branch and keep footage, spoken audio, captions and description consistent throughout.
- Capture real executed tool outcomes. Never generate screens that falsely imply a successful Amazon login, AWS invocation, Alexa deployment or purchase.
- Do not require a new billable AWS call just for footage. Historical AWS evidence can be shown only with its date and status labeled accurately; the local customer preview does not call Bedrock.
- Create a new caption track from the replacement's actual narration and timestamps, then review timing and spelling by watching/listening to the rendered cut. Estimated script timing is not reviewed caption timing.
- Verify final runtime, readable UI, audible narration and accurate on-screen boundaries. Recheck the thumbnail/title/description against the new consumer scope.
- Keep “not made for kids” as instructed. Obtain separate final publication confirmation, then verify the resulting public watch page and Devpost linkage. A new video upload has a different watch URL; update links only after the actual replacement exists.

## Latest test evidence

The September 5 rerun passed build, no-emit typecheck, lint and all **45 tests in 10 suites**, with no failed or skipped tests. These tests cover the current local implementation, not Login with Amazon or official Alexa tooling. The original media and captions remain unchanged. This document completes the discrepancy inventory, not video production or account linking.
